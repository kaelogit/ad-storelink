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
    .ilike('details', `%idem:${idempotencyKey}%`)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: order, error: orderFetchError } = await auth.supabase
    .from('orders')
    .select('status')
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

  const refundStatus = newStatus === 'CANCELLED' ? 'full' : 'none'

  const { error: updateError } = await auth.supabase
    .from('orders')
    .update({
      status: newStatus,
      refund_status: refundStatus,
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
    details: `Forced status ${currentStatus} -> ${newStatus}. Category: ${reasonCategory}. Reason: ${reason}. idem:${idempotencyKey}`,
  })

  return NextResponse.json({ ok: true })
}
