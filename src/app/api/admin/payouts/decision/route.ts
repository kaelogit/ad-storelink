import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type PayoutDecisionPayload = {
  payoutId?: string
  action?: 'approve' | 'reject'
  reasonCategory?: string
  reason?: string
}
const PAYOUT_REASON_CATEGORIES = new Set([
  'kyc_issue',
  'bank_mismatch',
  'fraud_risk',
  'reserve_policy',
  'manual_approval',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as PayoutDecisionPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const payoutId = body.payoutId?.trim()
  const action = body.action
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!payoutId || !action || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'payoutId, action, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  if (!PAYOUT_REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', `PAYOUT_${action.toUpperCase()}`)
    .eq('target_id', payoutId)
    .ilike('details', `%idem:${idempotencyKey}%`)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: payout, error: payoutFetchError } = await auth.supabase
    .from('payouts')
    .select('status')
    .eq('id', payoutId)
    .single()

  if (payoutFetchError || !payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
  }

  const currentStatus = (payout.status || '').toLowerCase()
  const status = action === 'approve' ? 'processed' : 'rejected'

  if (currentStatus === status) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  if (currentStatus !== 'pending') {
    return NextResponse.json(
      { error: `Payout is already finalized (${currentStatus})` },
      { status: 409 }
    )
  }

  const { error } = await auth.supabase.from('payouts').update({ status }).eq('id', payoutId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: `PAYOUT_${action.toUpperCase()}`,
    target_id: payoutId,
    details: `Payout status ${currentStatus} -> ${status}. Category: ${reasonCategory}. Reason: ${reason}. idem:${idempotencyKey}`,
  })

  return NextResponse.json({ ok: true })
}
