import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  userId?: string
  banned?: boolean
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const userId = body.userId?.trim()
  const banned = !!body.banned
  const reason = body.reason?.trim() || ''
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const actionType = banned ? 'GROUP_CREATE_BAN' : 'GROUP_CREATE_UNBAN'

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (banned && reason.length < 8) {
    return NextResponse.json({ error: 'Reason must be at least 8 characters when banning' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', actionType)
    .eq('target_id', userId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data, error } = await auth.supabase.rpc('admin_set_groups_create_ban', {
    p_user_id: userId,
    p_banned: banned,
    p_reason: reason || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: actionType,
    target_id: userId,
    details: { reason: reason || null, banned, idempotencyKey, result: data },
  })

  return NextResponse.json({ ok: true, result: data })
}
