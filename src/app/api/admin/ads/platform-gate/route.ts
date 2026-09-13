import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

const ADS_FLAG_KEY = 'ads_enabled'
const ADS_READ_ROLES = ['super_admin', 'moderator', 'content', 'support', 'analyst', 'finance'] as const

export async function GET() {
  const auth = await getApiAdminContext([...ADS_READ_ROLES])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_feature_flags', {
    p_query: ADS_FLAG_KEY,
    p_category: null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const flags = Array.isArray((data as { flags?: unknown[] })?.flags)
    ? ((data as { flags: Record<string, unknown>[] }).flags)
    : []
  const row = flags.find((f) => f?.key === ADS_FLAG_KEY) ?? flags[0] ?? null

  return NextResponse.json({
    key: ADS_FLAG_KEY,
    enabled: Boolean(row?.enabled),
    rolloutPercent: Number(row?.rollout_percent ?? 0),
    canToggle: auth.role === 'super_admin',
    role: auth.role,
  })
}

type GateUpdateBody = {
  enabled?: boolean
  rolloutPercent?: number
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as GateUpdateBody
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const reason = body.reason?.trim()
  const enabled = Boolean(body.enabled)
  const rolloutPercent = Math.floor(Number(body.rolloutPercent ?? (enabled ? 100 : 0)))

  if (!reason || reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }
  if (rolloutPercent < 0 || rolloutPercent > 100) {
    return NextResponse.json({ error: 'rolloutPercent must be 0–100' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'FEATURE_FLAG_CHANGE')
    .eq('target_id', ADS_FLAG_KEY)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: result, error } = await auth.supabase.rpc('admin_update_feature_flag', {
    p_key: ADS_FLAG_KEY,
    p_enabled: enabled,
    p_rollout_percent: rolloutPercent,
    p_reason: reason,
    p_config: null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'FEATURE_FLAG_CHANGE',
    target_id: ADS_FLAG_KEY,
    details: {
      message: `Ads platform gate ${enabled ? 'enabled' : 'disabled'} from Ads desk.`,
      key: ADS_FLAG_KEY,
      enabled,
      rolloutPercent,
      reason,
      idempotencyKey,
      result,
      source: 'ads_platform_gate',
    },
  })

  return NextResponse.json({ ok: true, result, enabled, rolloutPercent })
}
