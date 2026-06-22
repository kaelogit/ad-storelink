import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { inviteeId?: string; decision?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const inviteeId = (body.inviteeId || '').trim()
  const decision = (body.decision || '').trim().toLowerCase()
  const notes = (body.notes || '').trim() || null

  if (!inviteeId || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'inviteeId and decision (approved|rejected) required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('admin_review_referral_attribution', {
    p_invitee_id: inviteeId,
    p_decision: decision,
    p_notes: notes,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, result: data })
}
