import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type VerificationPayload = {
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
  let failedStep: 'merchant_verifications_update' | 'profiles_update' | 'admin_audit_logs_insert' | null = null

  const body = (await request.json()) as VerificationPayload
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

  const { error: updateError } = await auth.supabase
    .from('merchant_verifications')
    .update({
      status: decision === 'verified' ? 'approved' : 'rejected',
      rejection_reason: decision === 'rejected' ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) {
    failedStep = 'merchant_verifications_update'
    return NextResponse.json(
      { error: updateError.message, debug: { failedStep, requestId, profileId, decision } },
      { status: 400 }
    )
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
    failedStep = 'profiles_update'
    return NextResponse.json(
      { error: profileError.message, debug: { failedStep, requestId, profileId, decision } },
      { status: 400 }
    )
  }

  const { error: auditError } = await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'KYC_VERIFICATION',
    target_id: profileId,
    // `admin_audit_logs.details` is `jsonb`, so we must insert an object (not a plain string).
    details: {
      message: `Merchant ${decision === 'verified' ? 'Approved' : 'Rejected'}.`,
      requestId,
      profileId,
      decision,
      ...(decision === 'rejected'
        ? { reasonCategory, reason }
        : {}),
    },
  })

  if (auditError) {
    failedStep = 'admin_audit_logs_insert'
    // Do not block moderation outcome on audit write failures.
    // Verification/rejection is the core action; audit logging is best-effort.
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
