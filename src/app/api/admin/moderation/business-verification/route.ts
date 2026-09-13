import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type BusinessVerificationPayload = {
  requestId?: string
  profileId?: string
  decision?: 'verified' | 'rejected'
  reasonCategory?: string
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  let failedStep:
    | 'business_verifications_lookup'
    | 'business_verifications_update'
    | 'profiles_update'
    | 'admin_audit_logs_insert'
    | null = null

  const body = (await request.json()) as BusinessVerificationPayload
  const requestId = body.requestId?.trim()
  const profileId = body.profileId?.trim()
  const decision = body.decision
  const reasonCategory = body.reasonCategory?.trim() || 'other'
  const reason = body.reason?.trim()

  if (!requestId || !profileId || !decision) {
    return NextResponse.json(
      { error: 'requestId, profileId and decision are required' },
      { status: 400 }
    )
  }

  if (decision === 'rejected' && (!reason || reason.length < 10)) {
    return NextResponse.json(
      { error: 'Rejection requires a reason (min 10 characters)' },
      { status: 400 }
    )
  }

  const { data: existing, error: lookupError } = await auth.supabase
    .from('business_verifications')
    .select('id, user_id, status')
    .eq('id', requestId)
    .eq('user_id', profileId)
    .maybeSingle()

  if (lookupError || !existing) {
    failedStep = 'business_verifications_lookup'
    return NextResponse.json(
      {
        error: lookupError?.message || 'Business verification request not found for this profile',
        debug: { failedStep, requestId, profileId, decision },
      },
      { status: 400 }
    )
  }

  const { error: updateError } = await auth.supabase
    .from('business_verifications')
    .update({
      status: decision === 'verified' ? 'approved' : 'rejected',
      rejection_reason: decision === 'rejected' ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('user_id', profileId)

  if (updateError) {
    failedStep = 'business_verifications_update'
    return NextResponse.json(
      { error: updateError.message, debug: { failedStep, requestId, profileId, decision } },
      { status: 400 }
    )
  }

  const { error: profileError } = await auth.supabase
    .from('profiles')
    .update({
      business_verification_status: decision === 'verified' ? 'verified' : 'rejected',
    })
    .eq('id', profileId)

  if (profileError) {
    failedStep = 'profiles_update'
    return NextResponse.json(
      { error: profileError.message, debug: { failedStep, requestId, profileId, decision } },
      { status: 400 }
    )
  }

  const { error: auditError } = await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'BUSINESS_KYC_VERIFICATION',
    target_id: profileId,
    details: {
      message: `Business verification ${decision === 'verified' ? 'Approved' : 'Rejected'}.`,
      requestId,
      profileId,
      decision,
      ...(decision === 'rejected' ? { reasonCategory, reason } : {}),
    },
  })

  if (auditError) {
    failedStep = 'admin_audit_logs_insert'
    return NextResponse.json({
      ok: true,
      warning: 'Moderation applied, but audit log insert failed.',
      debug: {
        failedStep,
        requestId,
        profileId,
        decision,
        auditError: auditError.message,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
