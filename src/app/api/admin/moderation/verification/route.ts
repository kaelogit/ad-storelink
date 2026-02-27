import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type VerificationPayload = {
  requestId?: string
  profileId?: string
  decision?: 'verified' | 'rejected'
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as VerificationPayload
  const requestId = body.requestId?.trim()
  const profileId = body.profileId?.trim()
  const decision = body.decision

  if (!requestId || !profileId || !decision) {
    return NextResponse.json(
      { error: 'requestId, profileId and decision are required' },
      { status: 400 }
    )
  }

  const { error: updateError } = await auth.supabase
    .from('merchant_verifications')
    .update({ status: decision === 'verified' ? 'approved' : 'rejected' })
    .eq('id', requestId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Keep profiles.verification_status in sync so the app shows correct state
  const { error: profileError } = await auth.supabase
    .from('profiles')
    .update({
      ...(decision === 'verified'
        ? { is_verified: true, verification_status: 'verified' }
        : { verification_status: 'rejected' }),
    })
    .eq('id', profileId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'KYC_VERIFICATION',
    target_id: profileId,
    details: `Merchant ${decision === 'verified' ? 'Approved' : 'Rejected'}. Request ID: ${requestId}`,
  })

  return NextResponse.json({ ok: true })
}
