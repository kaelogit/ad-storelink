import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type FlagUpdatePayload = {
  key?: string
  enabled?: boolean
  rolloutPercent?: number
  reason?: string
  configPatch?: Record<string, unknown>
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as FlagUpdatePayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const key = body.key?.trim()
  const reason = body.reason?.trim()
  const rolloutPercent = Math.floor(Number(body.rolloutPercent ?? 0))
  const enabled = Boolean(body.enabled)

  if (!key || !reason) {
    return NextResponse.json({ error: 'key and reason are required' }, { status: 400 })
  }
  if (rolloutPercent < 0 || rolloutPercent > 100) {
    return NextResponse.json({ error: 'rolloutPercent must be 0–100' }, { status: 400 })
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
    .eq('action_type', 'FEATURE_FLAG_CHANGE')
    .eq('target_id', key)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: result, error } = await auth.supabase.rpc('admin_update_feature_flag', {
    p_key: key,
    p_enabled: enabled,
    p_rollout_percent: rolloutPercent,
    p_reason: reason,
    p_config: body.configPatch ?? null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'FEATURE_FLAG_CHANGE',
    target_id: key,
    details: {
      message: `Feature flag ${key} updated.`,
      key,
      enabled,
      rolloutPercent,
      reason,
      configPatch: body.configPatch ?? null,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json({ ok: true, result })
}
