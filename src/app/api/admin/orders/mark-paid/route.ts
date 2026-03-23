import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type MarkPaidPayload = {
  orderId?: string
  paymentReference?: string
}

/**
 * Reconcile an order stuck in AWAITING_PAYMENT when Paystack callback/webhook failed.
 * Sets order to PAID and payment_reference; optionally inserts the same chat message the webhook would.
 */
export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as MarkPaidPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const orderId = body.orderId?.trim()
  const paymentReference = body.paymentReference?.trim()

  if (!orderId || !paymentReference) {
    return NextResponse.json(
      { error: 'orderId and paymentReference are required' },
      { status: 400 }
    )
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'ORDER_INTERVENTION')
    .eq('target_id', orderId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: order, error: orderError } = await auth.supabase
    .from('orders')
    .select('id, status, chat_id, user_id, coin_redeemed')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const status = (order.status || '').toUpperCase()
  if (status !== 'AWAITING_PAYMENT') {
    return NextResponse.json(
      { error: `Order status is ${status}. Only AWAITING_PAYMENT can be marked paid.` },
      { status: 409 }
    )
  }

  const { error: updateError } = await auth.supabase
    .from('orders')
    .update({
      status: 'PAID',
      payment_reference: paymentReference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Defensive backfill for pre-trigger orders: ensure redeemed coins are deducted once.
  const coinsRedeemed = Number(order.coin_redeemed || 0)
  if (coinsRedeemed > 0) {
    const { error: coinDeductError } = await auth.supabase.rpc('deduct_coins_for_order', {
      p_amount: coinsRedeemed,
      p_order_id: orderId,
      p_user_id: order.user_id,
    })
    if (coinDeductError && !coinDeductError.message.includes('duplicate')) {
      return NextResponse.json({ error: coinDeductError.message }, { status: 409 })
    }
  }

  if (order.chat_id && order.user_id) {
    const orderRef = orderId.slice(0, 8).toUpperCase()
    await auth.supabase.from('messages').insert({
      conversation_id: order.chat_id,
      sender_id: order.user_id,
      text: `💰 PAYMENT SECURED for Order #${orderRef}! Seller, please ship the item.`,
      is_read: false,
    })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ORDER_INTERVENTION',
    target_id: orderId,
    details: {
      message: 'Marked as PAID (Paystack reconciliation).',
      orderId,
      paymentReference,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true })
}
