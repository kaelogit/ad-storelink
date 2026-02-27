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

  if (!disputeId || !orderId || !verdict || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'disputeId, orderId, verdict, reasonCategory and reason are required' },
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
    .ilike('details', `%idem:${idempotencyKey}%`)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: dispute, error: disputeFetchError } = await auth.supabase
    .from('disputes')
    .select('status')
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

  const action = verdict === 'refunded_buyer' ? 'Refund Buyer' : 'Release to Seller'
  const newOrderStatus = verdict === 'refunded_buyer' ? 'CANCELLED' : 'COMPLETED'
  const refundStatus = verdict === 'refunded_buyer' ? 'full' : 'none'

  const { error: disputeError } = await auth.supabase
    .from('disputes')
    .update({
      status: verdict,
      admin_verdict: `Resolved via Tribunal: ${action}`,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)

  if (disputeError) {
    return NextResponse.json({ error: disputeError.message }, { status: 400 })
  }

  const { error: orderError } = await auth.supabase
    .from('orders')
    .update({
      status: newOrderStatus,
      refund_status: refundStatus,
    })
    .eq('id', orderId)

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'DISPUTE_VERDICT',
    target_id: disputeId,
    details: `Verdict ${currentDisputeStatus} -> ${verdict}. Order updated to ${newOrderStatus}. Category: ${reasonCategory}. Reason: ${reason}. idem:${idempotencyKey}`,
  })

  return NextResponse.json({ ok: true })
}
