import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ExperimentPayload = {
  key?: string
  isActive?: boolean
  weights?: number[]
  freezeControl?: boolean
  reason?: string
}

const ALLOWED_KEYS = new Set([
  'home_feed_rank_v2',
  'explore_feed_rank_v2_discovery',
  'explore_feed_rank_v2_for_you',
  'explore_feed_rank_v2_spotlight',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ExperimentPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const key = body.key?.trim()
  const reason = body.reason?.trim()
  const freezeControl = Boolean(body.freezeControl)

  if (!key || !reason) {
    return NextResponse.json({ error: 'key and reason are required' }, { status: 400 })
  }
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: 'Invalid experiment key' }, { status: 400 })
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
    .eq('action_type', 'RANKING_EXPERIMENT_CHANGE')
    .eq('target_id', key)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: result, error } = await auth.supabase.rpc('admin_update_ranking_experiment', {
    p_key: key,
    p_is_active: typeof body.isActive === 'boolean' ? body.isActive : null,
    p_weights: Array.isArray(body.weights) ? body.weights : null,
    p_freeze_control: freezeControl,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'RANKING_EXPERIMENT_CHANGE',
    target_id: key,
    details: {
      message: `Ranking experiment ${key} updated.`,
      key,
      isActive: body.isActive ?? null,
      weights: body.weights ?? null,
      freezeControl,
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json({ ok: true, result })
}
