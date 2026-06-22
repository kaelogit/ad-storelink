import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../../utils/auth/apiAdmin'

type ResetPayload = {
  userId?: string
  reasonCategory?: string
  reason?: string
}

const REASON_CATEGORIES = new Set([
  'customer_request',
  'number_change',
  'fraud_investigation',
  'support_resolution',
  'termii_failure',
  'account_recovery',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ResetPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const userId = body.userId?.trim()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!userId || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'userId, reasonCategory and reason are required' },
      { status: 400 },
    )
  }
  if (!REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'PHONE_VERIFICATION_RESET')
    .eq('target_id', userId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const auditReason = `[${reasonCategory}] ${reason}`

  const { data: status, error } = await auth.supabase.rpc('admin_reset_phone_verification', {
    p_user_id: userId,
    p_reason: auditReason,
  })

  if (error) {
    const msg = error.message || 'Reset failed'
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.toLowerCase().includes('already reset')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    if (msg.toLowerCase().includes('requires')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'PHONE_VERIFICATION_RESET',
    target_id: userId,
    details: {
      message: 'Admin reset phone verification; user must re-verify on next sensitive action.',
      userId,
      reasonCategory,
      reason,
      idempotencyKey,
      status,
    },
  })

  return NextResponse.json({ ok: true, status })
}
