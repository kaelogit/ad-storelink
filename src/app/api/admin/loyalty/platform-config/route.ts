import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  platformMaxPercentage?: number
  notes?: string
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const platformMaxPercentage = Number(body.platformMaxPercentage)
  const reason = body.reason?.trim()
  const notes = body.notes?.trim()

  if (!Number.isFinite(platformMaxPercentage)) {
    return NextResponse.json({ error: 'platformMaxPercentage is required' }, { status: 400 })
  }
  if (!reason || reason.length < 10) {
    return NextResponse.json({ error: 'reason is required (min 10 characters)' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'LOYALTY_PLATFORM_CONFIG')
    .eq('target_id', 'default')
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: result, error } = await auth.supabase.rpc('admin_update_loyalty_platform_config', {
    p_platform_max_percentage: platformMaxPercentage,
    p_notes: notes || null,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'LOYALTY_PLATFORM_CONFIG',
    target_id: 'default',
    details: {
      message: 'Loyalty platform max percentage updated.',
      platformMaxPercentage,
      notes: notes || null,
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json({ ok: true, result })
}
