import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ForceServiceOrderStatusPayload = {
  serviceOrderId?: string
  newStatus?: 'completed' | 'cancelled' | 'refunded'
  reasonCategory?: string
  reason?: string
}

const ALLOWED_STATUSES = new Set(['completed', 'cancelled', 'refunded'])
const REASON_CATEGORIES = new Set([
  'fraud',
  'payment_issue',
  'customer_request',
  'no_show',
  'fulfillment_issue',
  'compliance',
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
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ForceServiceOrderStatusPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const serviceOrderId = body.serviceOrderId?.trim()
  const newStatus = body.newStatus?.toLowerCase()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!serviceOrderId || !newStatus || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'serviceOrderId, newStatus, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!ALLOWED_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: `newStatus must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 400 }
    )
  }

  if (!REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'BOOKING_FORCE_STATUS_API')
    .eq('target_id', serviceOrderId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  let refundResult: {
    executed: boolean
    orderId?: string
    currencyCode?: string
    paystackReference?: string | null
  } = { executed: false }
  let clawbackDebt: {
    id: string
    amountMinor: number
    currencyCode: string
    sellerId: string
  } | null = null

  if (newStatus === 'refunded') {
    const { data: so, error: soErr } = await auth.supabase
      .from('service_orders')
      .select('id, amount_minor, currency_code, seller_id, buyer_id, released_at_start, released_at_complete')
      .eq('id', serviceOrderId)
      .maybeSingle()
    if (soErr || !so) {
      return NextResponse.json({ error: 'Service order not found' }, { status: 404 })
    }
    const amountMinor = Number(so.amount_minor || 0)
    const releasedMinor =
      so.released_at_complete
        ? amountMinor
        : so.released_at_start
          ? Math.floor(amountMinor * 0.3)
          : 0

    const { data: orderItem, error: orderItemError } = await auth.supabase
      .from('order_items')
      .select('order_id')
      .eq('service_order_id', serviceOrderId)
      .not('order_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (orderItemError || !orderItem?.order_id) {
      return NextResponse.json(
        { error: 'No linked order found for this booking. Refund cannot be processed safely.' },
        { status: 409 }
      )
    }

    const { data: order, error: orderError } = await auth.supabase
      .from('orders')
      .select('id, payment_reference, total_amount, currency_code, payout_status, refund_status')
      .eq('id', orderItem.order_id)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Linked order not found.' }, { status: 404 })
    }
    if (!order.payment_reference) {
      return NextResponse.json(
        { error: 'Linked order has no payment reference; cannot submit Paystack refund.' },
        { status: 409 }
      )
    }

    refundResult = { executed: false, orderId: order.id, currencyCode: order.currency_code || 'NGN' }
    const alreadyRefunded =
      (order.refund_status || '').toLowerCase() === 'processed' ||
      (order.payout_status || '').toLowerCase() === 'refunded'
    const previousPayoutStatus = order.payout_status || null

    if (!alreadyRefunded) {
      const { data: claimRow } = await auth.supabase
        .from('orders')
        .update({
          payout_status: 'refund_processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .not('payout_status', 'in', '(refunded,refund_processing)')
        .select('id, payment_reference, refund_status, payout_status')
        .maybeSingle()
      if (!claimRow) {
        const { data: latestOrder } = await auth.supabase
          .from('orders')
          .select('payment_reference, refund_status, payout_status')
          .eq('id', order.id)
          .maybeSingle()
        const nowRefunded =
          (latestOrder?.refund_status || '').toLowerCase() === 'processed' ||
          (latestOrder?.payout_status || '').toLowerCase() === 'refunded' ||
          (latestOrder?.payout_status || '').toLowerCase() === 'refund_processing'
        if (nowRefunded) {
          refundResult = {
            executed: true,
            orderId: order.id,
            currencyCode: order.currency_code || 'NGN',
            paystackReference: latestOrder?.payment_reference ?? order.payment_reference,
          }
        } else {
          return NextResponse.json(
            { error: 'Refund could not be safely claimed. Retry shortly.' },
            { status: 409 }
          )
        }
      } else {
      const paystackKey = getPaystackKey(order.currency_code || 'NGN')
      if (!paystackKey) {
        await auth.supabase
          .from('orders')
          .update({ payout_status: previousPayoutStatus, updated_at: new Date().toISOString() })
          .eq('id', order.id)
        return NextResponse.json(
          { error: `Missing Paystack key for ${order.currency_code || 'NGN'}. Set PAYSTACK_SECRET_KEY_*.` },
          { status: 503 }
        )
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
        const providerMessage = paystackJson?.message || 'Paystack refund request failed'
        if (!isProviderAlreadyRefunded(providerMessage)) {
          await auth.supabase
            .from('orders')
            .update({
              payout_status: previousPayoutStatus,
              payout_error_log: `Refund failed: ${providerMessage}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)
          return NextResponse.json(
            {
              error: `Refund failed at provider: ${providerMessage}. Booking status not changed.`,
              refund: { executed: false, orderId: order.id, currencyCode: order.currency_code || 'NGN' },
            },
            { status: 409 }
          )
        }
      }

      const paystackReference =
        paystackJson?.data?.refund_reference ??
        paystackJson?.data?.transaction_reference ??
        order.payment_reference

      const { error: markOrderError } = await auth.supabase
        .from('orders')
        .update({
          payout_status: 'refunded',
          refund_status: 'processed',
          payout_error_log: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (markOrderError) {
        return NextResponse.json(
          {
            error: `Refund executed but order update failed: ${markOrderError.message}.`,
            refund: {
              executed: true,
              orderId: order.id,
              currencyCode: order.currency_code || 'NGN',
              paystackReference,
            },
          },
          { status: 500 }
        )
      }

      refundResult = {
        executed: true,
        orderId: order.id,
        currencyCode: order.currency_code || 'NGN',
        paystackReference,
      }
      }
    } else {
      refundResult = {
        executed: true,
        orderId: order.id,
        currencyCode: order.currency_code || 'NGN',
        paystackReference: order.payment_reference,
      }
    }

    // Company-funded refund after release: create seller clawback debt and lock seller app access until repayment.
    if (releasedMinor > 0 && so.seller_id && so.buyer_id) {
      const debtPayload = {
        service_order_id: so.id,
        order_id: order.id,
        seller_id: so.seller_id,
        buyer_id: so.buyer_id,
        currency_code: so.currency_code || order.currency_code || 'NGN',
        amount_minor: releasedMinor,
        reason: `Company-funded refund after dispute. Recover released payout from seller. Service order: ${so.id}`,
        status: 'open',
        paid_at: null,
        paid_reference: null,
      }
      const { data: debtRow, error: debtError } = await auth.supabase
        .from('seller_clawback_debts')
        .upsert(debtPayload, { onConflict: 'service_order_id' })
        .select('id, amount_minor, currency_code, seller_id')
        .single()
      if (debtError || !debtRow) {
        return NextResponse.json(
          { error: `Refund completed but clawback debt creation failed: ${debtError?.message || 'unknown error'}` },
          { status: 500 }
        )
      }
      clawbackDebt = {
        id: debtRow.id,
        amountMinor: Number(debtRow.amount_minor || 0),
        currencyCode: debtRow.currency_code || 'NGN',
        sellerId: debtRow.seller_id,
      }
    }
  }

  const { data, error } = await auth.supabase.rpc('admin_force_service_order_status', {
    p_service_order_id: serviceOrderId,
    p_new_status: newStatus,
    p_reason_category: reasonCategory,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message, refund: refundResult }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'BOOKING_FORCE_STATUS_API',
    target_id: serviceOrderId,
    details: {
      message: 'Booking force-status API processed.',
      serviceOrderId,
      newStatus,
      reasonCategory,
      idempotencyKey,
      refund: refundResult,
      clawbackDebt,
    },
  })

  return NextResponse.json({
    ...(data ?? { ok: true }),
    refund: refundResult,
    clawbackDebt,
    mode: newStatus === 'refunded' ? 'refund+status' : 'status-only',
  })
}
