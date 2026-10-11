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

  if (auth.userId === profileId) {
    return NextResponse.json(
      { error: 'You cannot approve or reject your own KYC. Another admin must review it.' },
      { status: 403 }
    )
  }

  const { data, error } = await auth.supabase.rpc('admin_decide_merchant_verification', {
    p_request_id: requestId,
    p_profile_id: profileId,
    p_decision: decision,
    p_reason: reason ?? null,
    p_reason_category: reasonCategory,
  })

  if (error) {
    const msg = error.message || ''
    const isSelf = /cannot_decide_own_verification/i.test(msg)
    return NextResponse.json(
      {
        error: isSelf
          ? 'You cannot approve or reject your own KYC. Another admin must review it.'
          : msg,
        debug: { failedStep: 'admin_decide_merchant_verification', requestId, profileId, decision },
      },
      { status: isSelf ? 403 : 400 }
    )
  }

  return NextResponse.json({ ok: true, ...(typeof data === 'object' && data ? data : {}) })
}
