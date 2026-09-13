import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  groupId?: string
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const groupId = body.groupId?.trim()
  const reason = body.reason?.trim() || ''
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()

  if (!groupId) {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  }
  if (reason.length < 8) {
    return NextResponse.json({ error: 'Reason must be at least 8 characters' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'GROUP_FORCE_ARCHIVE')
    .eq('target_id', groupId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data, error } = await auth.supabase.rpc('archive_group_chat', {
    p_group_id: groupId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'GROUP_FORCE_ARCHIVE',
    target_id: groupId,
    details: { reason, idempotencyKey, result: data },
  })

  return NextResponse.json({ ok: true, result: data })
}
