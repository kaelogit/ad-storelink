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

type LinkedOrderRow = {
  id: string
  payment_reference: string | null
  total_amount: number | null
  currency_code: string | null
  payout_status: string | null
  refund_status: string | null
  payment_leg?: string | null
}

async function refundOneOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  order: LinkedOrderRow,
): Promise<{ executed: boolean; orderId: string; currencyCode: string; paystackReference?: string | null; error?: string }> {
  const currencyCode = order.currency_code || 'NGN'
  const alreadyRefunded =
    (order.refund_status || '').toLowerCase() === 'processed' ||
    (order.payout_status || '').toLowerCase() === 'refunded'

  if (alreadyRefunded) {
    return {
      executed: true,
      orderId: order.id,
      currencyCode,
      paystackReference: order.payment_reference,
    }
  }

  if (!order.payment_reference) {
    return {
      executed: false,
      orderId: order.id,
      currencyCode,
      error: 'Linked order has no payment reference; cannot submit Paystack refund.',
    }
  }

  const previousPayoutStatus = order.payout_status || null
  const { data: claimRow } = await supabase
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
    const { data: latestOrder } = await supabase
      .from('orders')
      .select('payment_reference, refund_status, payout_status')
      .eq('id', order.id)
      .maybeSingle()
    const nowRefunded =
      (latestOrder?.refund_status || '').toLowerCase() === 'processed' ||
      (latestOrder?.payout_status || '').toLowerCase() === 'refunded' ||
      (latestOrder?.payout_status || '').toLowerCase() === 'refund_processing'
    if (nowRefunded) {
      return {
        executed: true,
        orderId: order.id,
        currencyCode,
        paystackReference: latestOrder?.payment_reference ?? order.payment_reference,
      }
    }
    return {
      executed: false,
      orderId: order.id,
      currencyCode,
      error: 'Refund could not be safely claimed. Retry shortly.',
    }
  }

  const paystackKey = getPaystackKey(currencyCode)
  if (!paystackKey) {
    await supabase
      .from('orders')
      .update({ payout_status: previousPayoutStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    return {
      executed: false,
      orderId: order.id,
      currencyCode,
      error: `Missing Paystack key for ${currencyCode}. Set PAYSTACK_SECRET_KEY_*.`,
    }
  }

  const amountSmallest = toSmallestUnit(Number(order.total_amount) || 0, currencyCode)
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
      await supabase
        .from('orders')
        .update({
          payout_status: previousPayoutStatus,
          payout_error_log: `Refund failed: ${providerMessage}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
      return {
        executed: false,
        orderId: order.id,
        currencyCode,
        error: `Refund failed at provider: ${providerMessage}. Booking status not changed.`,
      }
    }
  }

  const paystackReference =
    paystackJson?.data?.refund_reference ??
    paystackJson?.data?.transaction_reference ??
    order.payment_reference

  const { error: markOrderError } = await supabase
    .from('orders')
    .update({
      payout_status: 'refunded',
      refund_status: 'processed',
      payout_error_log: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (markOrderError) {
    return {
      executed: true,
      orderId: order.id,
      currencyCode,
      paystackReference,
      error: `Refund executed but order update failed: ${markOrderError.message}.`,
    }
  }

  // Best-effort leg sync (DB trigger also runs).
  await supabase.rpc('mark_service_order_leg_refunded_for_order', { p_order_id: order.id })

  return {
    executed: true,
    orderId: order.id,
    currencyCode,
    paystackReference,
  }
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
      { status: 400 },
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!ALLOWED_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: `newStatus must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 400 },
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
    orders?: Array<{
      orderId: string
      executed: boolean
      currencyCode: string
      paymentLeg?: string | null
      paystackReference?: string | null
      error?: string
    }>
    heldMinor?: number
    clawbackCapMinor?: number
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
      .select(
        'id, amount_minor, currency_code, seller_id, buyer_id, released_at_start, released_at_complete, payment_state',
      )
      .eq('id', serviceOrderId)
      .maybeSingle()
    if (soErr || !so) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: moneySummary } = await auth.supabase.rpc('get_service_order_refund_money_summary', {
      p_service_order_id: serviceOrderId,
    })
    const summary = (moneySummary || {}) as {
      held_minor?: number
      clawback_cap_minor?: number
      currency_code?: string
    }
    const clawbackCapMinor = Number(summary.clawback_cap_minor || 0)
    const heldMinor = Number(summary.held_minor || 0)

    // Prefer paid payment legs; fall back to any PAID linked orders.
    const { data: legRows } = await auth.supabase
      .from('service_order_payment_legs')
      .select('order_id, leg, status, amount_minor')
      .eq('service_order_id', serviceOrderId)
      .eq('status', 'paid')

    const orderIds = Array.from(
      new Set((legRows || []).map((r: { order_id?: string | null }) => r.order_id).filter(Boolean) as string[]),
    )

    let ordersToRefund: LinkedOrderRow[] = []

    if (orderIds.length > 0) {
      const { data: orders, error: ordersError } = await auth.supabase
        .from('orders')
        .select('id, payment_reference, total_amount, currency_code, payout_status, refund_status')
        .in('id', orderIds)
      if (ordersError || !orders?.length) {
        return NextResponse.json(
          { error: 'Paid payment legs found but linked orders could not be loaded.' },
          { status: 409 },
        )
      }
      const legByOrder = new Map(
        (legRows || []).map((r: { order_id?: string | null; leg?: string | null }) => [
          String(r.order_id),
          r.leg || null,
        ]),
      )
      ordersToRefund = orders.map((o) => ({
        ...o,
        payment_leg: legByOrder.get(o.id) ?? null,
      }))
    } else {
      const { data: orderItem, error: orderItemError } = await auth.supabase
        .from('order_items')
        .select('order_id')
        .eq('service_order_id', serviceOrderId)
        .not('order_id', 'is', null)
        .limit(8)
      if (orderItemError || !orderItem?.length) {
        return NextResponse.json(
          { error: 'No linked order found for this booking. Refund cannot be processed safely.' },
          { status: 409 },
        )
      }
      const ids = orderItem.map((r: { order_id: string }) => r.order_id)
      const { data: orders, error: ordersError } = await auth.supabase
        .from('orders')
        .select('id, payment_reference, total_amount, currency_code, payout_status, refund_status, status')
        .in('id', ids)
      if (ordersError || !orders?.length) {
        return NextResponse.json({ error: 'Linked order not found.' }, { status: 404 })
      }
      ordersToRefund = orders
        .filter((o) => {
          const st = String(o.status || '').toUpperCase()
          const refunded =
            (o.refund_status || '').toLowerCase() === 'processed' ||
            (o.payout_status || '').toLowerCase() === 'refunded'
          return refunded || ['PAID', 'SHIPPED', 'COMPLETED', 'DISPUTE_OPEN', 'CANCELLED'].includes(st)
        })
        .map((o) => ({ ...o, payment_leg: 'full' as string | null }))
    }

    if (ordersToRefund.length === 0) {
      return NextResponse.json(
        { error: 'No refundable paid orders found for this booking.' },
        { status: 409 },
      )
    }

    const perOrderResults: NonNullable<(typeof refundResult)['orders']> = []
    for (const order of ordersToRefund) {
      const result = await refundOneOrder(auth.supabase, order)
      perOrderResults.push({
        orderId: result.orderId,
        executed: result.executed,
        currencyCode: result.currencyCode,
        paymentLeg: order.payment_leg,
        paystackReference: result.paystackReference,
        error: result.error,
      })
      if (result.error && !result.executed) {
        return NextResponse.json(
          {
            error: result.error,
            refund: {
              executed: false,
              orders: perOrderResults,
              heldMinor,
              clawbackCapMinor,
            },
          },
          { status: result.error.includes('Missing Paystack') ? 503 : 409 },
        )
      }
    }

    refundResult = {
      executed: perOrderResults.every((r) => r.executed),
      orderId: perOrderResults[0]?.orderId,
      currencyCode: perOrderResults[0]?.currencyCode || so.currency_code || 'NGN',
      paystackReference: perOrderResults[0]?.paystackReference,
      orders: perOrderResults,
      heldMinor,
      clawbackCapMinor,
    }

    // Clawback capped by released-from-held (never full package when only deposit was funded).
    if (clawbackCapMinor > 0 && so.seller_id && so.buyer_id) {
      const debtPayload = {
        service_order_id: so.id,
        order_id: perOrderResults[0]?.orderId || null,
        seller_id: so.seller_id,
        buyer_id: so.buyer_id,
        currency_code: so.currency_code || perOrderResults[0]?.currencyCode || 'NGN',
        amount_minor: clawbackCapMinor,
        reason: `Company-funded refund after dispute. Recover released payout (capped by held funds ${heldMinor}). Booking: ${so.id}`,
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
          {
            error: `Refund completed but clawback debt creation failed: ${debtError?.message || 'unknown error'}`,
            refund: refundResult,
          },
          { status: 500 },
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
