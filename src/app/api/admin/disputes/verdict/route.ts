import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type VerdictPayload = {
  disputeId?: string
  orderId?: string
  verdict?: 'refunded_buyer' | 'released_seller'
  reasonCategory?: string
  reason?: string
}
const DISPUTE_REASON_CATEGORIES = new Set([
  'item_not_received',
  'item_not_as_described',
  'chargeback_risk',
  'policy_violation',
  'manual_exception',
  'other',
])

function toSmallestUnit(amount: number, currencyCode: string): number {
  const code = (currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return Math.round(amount * Math.pow(10, decimals))
}

function getPaystackKey(currencyCode: string): string | null {
  const code = (currencyCode || 'NGN').toUpperCase()
  const suffix =
    code === 'NGN'
      ? 'NG'
      : code === 'GHS'
        ? 'GH'
        : code === 'ZAR'
          ? 'ZA'
          : code === 'KES'
            ? 'KE'
            : code === 'XOF'
              ? 'CI'
              : code === 'EGP'
                ? 'EG'
                : code === 'RWF'
                  ? 'RW'
                  : 'NG'
  return process.env[`PAYSTACK_SECRET_KEY_${suffix}`] ?? (code === 'NGN' ? process.env.PAYSTACK_SECRET_KEY ?? null : null)
}

function isProviderAlreadyRefunded(message: string | undefined): boolean {
  const m = (message || '').toLowerCase()
  return m.includes('already refunded') || m.includes('already been refunded') || m.includes('duplicate')
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as VerdictPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const disputeId = body.disputeId?.trim()
  const orderId = body.orderId?.trim()
  const verdict = body.verdict
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!disputeId || !verdict || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'disputeId, verdict, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  if (!DISPUTE_REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'DISPUTE_VERDICT')
    .eq('target_id', disputeId)
    // admin_audit_logs.details is jsonb; cast JSON key -> text for reliable filtering
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: dispute, error: disputeFetchError } = await auth.supabase
    .from('disputes')
    .select('status, order_id')
    .eq('id', disputeId)
    .single()

  if (disputeFetchError || !dispute) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  }

  const currentDisputeStatus = (dispute.status || '').toLowerCase()
  if (currentDisputeStatus === verdict) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  if (currentDisputeStatus !== 'open') {
    return NextResponse.json(
      { error: `Only open disputes can receive a verdict (current: ${currentDisputeStatus})` },
      { status: 409 }
    )
  }
  const disputeOrderId = (dispute.order_id || '').trim()
  if (!disputeOrderId) {
    return NextResponse.json({ error: 'Dispute is missing order linkage' }, { status: 409 })
  }
  if (orderId && orderId !== disputeOrderId) {
    return NextResponse.json(
      { error: 'orderId does not match dispute.order_id' },
      { status: 409 }
    )
  }

  const action = verdict === 'refunded_buyer' ? 'Refund Buyer' : 'Release to Seller'
  const newOrderStatus = verdict === 'refunded_buyer' ? 'CANCELLED' : 'COMPLETED'
  const refundStatus = verdict === 'refunded_buyer' ? 'full' : 'none'
  let refundResult: { executed: boolean; paystackReference?: string | null } = { executed: false }
  let refundClaimed = false
  let previousPayoutStatus: string | null = null

  if (verdict === 'refunded_buyer') {
    const { data: order, error: orderFetchError } = await auth.supabase
      .from('orders')
      .select('id, payment_reference, total_amount, currency_code, refund_status, payout_status')
      .eq('id', disputeOrderId)
      .maybeSingle()
    if (orderFetchError || !order) {
      return NextResponse.json({ error: 'Linked order not found' }, { status: 404 })
    }
    const alreadyRefunded =
      (order.refund_status || '').toLowerCase() === 'processed' ||
      (order.payout_status || '').toLowerCase() === 'refunded'
    previousPayoutStatus = order.payout_status || null
    if (!alreadyRefunded) {
      if (!order.payment_reference) {
        return NextResponse.json({ error: 'Order has no payment reference; cannot process refund.' }, { status: 409 })
      }
      const { data: claimRow } = await auth.supabase
        .from('orders')
        .update({
          payout_status: 'refund_processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', disputeOrderId)
        .not('payout_status', 'in', '(refunded,refund_processing)')
        .select('id')
        .maybeSingle()
      if (!claimRow) {
        const { data: latestOrder } = await auth.supabase
          .from('orders')
          .select('payout_status, refund_status, payment_reference')
          .eq('id', disputeOrderId)
          .maybeSingle()
        const nowRefunded =
          (latestOrder?.refund_status || '').toLowerCase() === 'processed' ||
          (latestOrder?.payout_status || '').toLowerCase() === 'refunded' ||
          (latestOrder?.payout_status || '').toLowerCase() === 'refund_processing'
        if (nowRefunded) {
          refundResult = { executed: true, paystackReference: latestOrder?.payment_reference ?? order.payment_reference }
        } else {
          return NextResponse.json({ error: 'Refund could not be safely claimed. Retry shortly.' }, { status: 409 })
        }
      } else {
        refundClaimed = true
      }

      if (!refundClaimed) {
        // Another worker already claimed this refund path.
      } else {
      const paystackKey = getPaystackKey(order.currency_code || 'NGN')
      if (!paystackKey) {
        await auth.supabase
          .from('orders')
          .update({ payout_status: previousPayoutStatus, updated_at: new Date().toISOString() })
          .eq('id', disputeOrderId)
        return NextResponse.json({ error: `Missing Paystack key for ${order.currency_code || 'NGN'}.` }, { status: 503 })
      }
      const amountSmallest = toSmallestUnit(Number(order.total_amount) || 0, order.currency_code || 'NGN')
      const paystackResp = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: order.payment_reference,
          amount: amountSmallest,
        }),
      })
      const paystackJson = (await paystackResp.json().catch(() => ({}))) as {
        status?: boolean
        message?: string
        data?: { refund_reference?: string; transaction_reference?: string }
      }
      if (!paystackResp.ok || !paystackJson?.status) {
        const providerMessage = paystackJson?.message || 'Paystack refund failed'
        if (!isProviderAlreadyRefunded(providerMessage)) {
          await auth.supabase
            .from('orders')
            .update({
              payout_status: previousPayoutStatus,
              payout_error_log: `Refund failed: ${providerMessage}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', disputeOrderId)
          return NextResponse.json({ error: `Refund failed at provider: ${providerMessage}` }, { status: 409 })
        }
      }
      refundResult = {
        executed: true,
        paystackReference:
          paystackJson?.data?.refund_reference ??
          paystackJson?.data?.transaction_reference ??
          order.payment_reference,
      }
      }
    } else {
      refundResult = { executed: true, paystackReference: order.payment_reference }
    }
  }

  const { error: disputeError } = await auth.supabase
    .from('disputes')
    .update({
      status: verdict,
      admin_verdict: `Resolved via Tribunal: ${action}`,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)

  if (disputeError) {
    if (verdict === 'refunded_buyer' && refundResult.executed) {
      // Ensure we never leave this order in refund_processing after provider success.
      await auth.supabase
        .from('orders')
        .update({
          payout_status: 'refunded',
          refund_status: 'processed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', disputeOrderId)
    }
    return NextResponse.json({ error: disputeError.message }, { status: 400 })
  }

  const { error: orderError } = await auth.supabase
    .from('orders')
    .update(
      verdict === 'refunded_buyer'
        ? { status: newOrderStatus, refund_status: refundStatus, payout_status: 'refunded' }
        : { status: newOrderStatus, refund_status: refundStatus }
    )
    .eq('id', disputeOrderId)

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'DISPUTE_VERDICT',
    target_id: disputeId,
    details: {
      message: 'Dispute verdict applied.',
      disputeId,
      orderId: disputeOrderId,
      from: currentDisputeStatus,
      verdict,
      newOrderStatus,
      reasonCategory,
      reason,
      idempotencyKey,
      refund: refundResult,
    },
  })

  return NextResponse.json({
    ok: true,
    mode: verdict === 'refunded_buyer' ? 'refund+status' : 'status-only',
    refund: refundResult,
  })
}
