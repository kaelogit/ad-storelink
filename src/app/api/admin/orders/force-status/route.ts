import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ForceOrderStatusPayload = {
  orderId?: string
  newStatus?: 'COMPLETED' | 'CANCELLED'
  reasonCategory?: string
  reason?: string
}

const TERMINAL_ORDER_STATUSES = new Set(['COMPLETED', 'CANCELLED'])
const MANUALLY_SETTLEABLE_STATUSES = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DISPUTE_OPEN',
])
const ORDER_REASON_CATEGORIES = new Set([
  'fraud',
  'payment_issue',
  'customer_request',
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

  const body = (await request.json()) as ForceOrderStatusPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const orderId = body.orderId?.trim()
  const newStatus = body.newStatus
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!orderId || !newStatus || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'orderId, newStatus, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  if (!ORDER_REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'ORDER_INTERVENTION')
    .eq('target_id', orderId)
    // admin_audit_logs.details is jsonb; cast JSON key -> text for reliable filtering
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: order, error: orderFetchError } = await auth.supabase
    .from('orders')
    .select('id, status, payment_reference, total_amount, currency_code, refund_status, payout_status')
    .eq('id', orderId)
    .single()

  if (orderFetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const currentStatus = (order.status || '').toUpperCase()
  if (currentStatus === newStatus) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  if (TERMINAL_ORDER_STATUSES.has(currentStatus)) {
    return NextResponse.json(
      { error: `Order is terminal (${currentStatus}) and cannot transition to ${newStatus}` },
      { status: 409 }
    )
  }

  if (!MANUALLY_SETTLEABLE_STATUSES.has(currentStatus)) {
    return NextResponse.json(
      { error: `Order status ${currentStatus} cannot be manually forced to ${newStatus}` },
      { status: 409 }
    )
  }

  let refundResult: {
    executed: boolean
    orderId: string
    paystackReference?: string | null
  } = {
    executed: false,
    orderId,
  }
  const previousPayoutStatus: string | null = order.payout_status || null

  if (newStatus === 'CANCELLED') {
    const alreadyRefunded =
      (order.refund_status || '').toLowerCase() === 'processed' ||
      (order.payout_status || '').toLowerCase() === 'refunded'
    if (!alreadyRefunded) {
      const isUnpaidOrder = currentStatus === 'PENDING' || currentStatus === 'AWAITING_PAYMENT'
      if (isUnpaidOrder) {
        refundResult = { executed: true, orderId, paystackReference: null }
      } else if (!order.payment_reference) {
        return NextResponse.json(
          { error: 'Paid order has no payment reference; cannot process refund safely.' },
          { status: 409 }
        )
      }
      if (!isUnpaidOrder) {
        const { data: claimRow } = await auth.supabase
          .from('orders')
          .update({
            payout_status: 'refund_processing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .not('payout_status', 'in', '(refunded,refund_processing)')
          .select('id, payout_status')
          .maybeSingle()
        if (!claimRow) {
          const { data: latestOrder } = await auth.supabase
            .from('orders')
            .select('payout_status, refund_status, payment_reference')
            .eq('id', orderId)
            .maybeSingle()
          const nowRefunded =
            (latestOrder?.refund_status || '').toLowerCase() === 'processed' ||
            (latestOrder?.payout_status || '').toLowerCase() === 'refunded' ||
            (latestOrder?.payout_status || '').toLowerCase() === 'refund_processing'
          if (nowRefunded) {
            refundResult = {
              executed: true,
              orderId,
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
            .eq('id', orderId)
          return NextResponse.json(
            { error: `Missing Paystack key for ${order.currency_code || 'NGN'}.` },
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
          const providerMessage = paystackJson?.message || 'Paystack refund failed'
          if (isProviderAlreadyRefunded(providerMessage)) {
            refundResult = {
              executed: true,
              orderId,
              paystackReference: order.payment_reference,
            }
          } else {
            await auth.supabase
              .from('orders')
              .update({
                payout_status: previousPayoutStatus,
                payout_error_log: `Refund failed: ${providerMessage}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orderId)
            return NextResponse.json(
              { error: `Refund failed at provider: ${providerMessage}` },
              { status: 409 }
            )
          }
        } else {
          const paystackReference =
            paystackJson?.data?.refund_reference ??
            paystackJson?.data?.transaction_reference ??
            order.payment_reference
          refundResult = {
            executed: true,
            orderId,
            paystackReference,
          }
        }
        }
      }
    } else {
      refundResult = {
        executed: true,
        orderId,
        paystackReference: order.payment_reference,
      }
    }
  }

  const { error: updateError } = await auth.supabase
    .from('orders')
    .update({
      status: newStatus,
      refund_status: newStatus === 'CANCELLED' ? 'full' : 'none',
      payout_status:
        newStatus === 'CANCELLED'
          ? currentStatus === 'PENDING' || currentStatus === 'AWAITING_PAYMENT'
            ? 'none'
            : 'refunded'
          : order.payout_status,
    })
    .eq('id', orderId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ORDER_INTERVENTION',
    target_id: orderId,
    details: {
      message: 'Forced order status.',
      orderId,
      from: currentStatus,
      to: newStatus,
      reasonCategory,
      reason,
      idempotencyKey,
      refund: refundResult,
    },
  })

  return NextResponse.json({
    ok: true,
    mode: newStatus === 'CANCELLED' ? 'refund+status' : 'status-only',
    refund: refundResult,
  })
}
