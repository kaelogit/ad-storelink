import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type KillSwitchPayload = {
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as KillSwitchPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const reason = body.reason?.trim()

  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
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
    .eq('action_type', 'RANKING_KILL_SWITCH')
    .eq('target_id', 'ranking_v2')
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: result, error } = await auth.supabase.rpc('admin_ranking_kill_switch', {
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'RANKING_KILL_SWITCH',
    target_id: 'ranking_v2',
    details: {
      message: 'Ranking v2 kill switch executed (flags off + experiments frozen to control).',
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json({ ok: true, result })
}
