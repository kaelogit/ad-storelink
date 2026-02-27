import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET() {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: sessions, error: sessionsError } = await auth.supabase
    .from('admin_sessions')
    .select('*')
    .order('last_activity', { ascending: false })

  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 400 })
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const adminIds = Array.from(new Set(sessions.map((s) => s.admin_id as string)))

  const { data: admins, error: adminsError } = await auth.supabase
    .from('admin_users')
    .select('id, email, full_name, role')
    .in('id', adminIds)

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 400 })
  }

  const byId = new Map(admins?.map((a) => [a.id, a]) ?? [])

  const enriched = sessions.map((s) => {
    const admin = byId.get(s.admin_id as string)
    return {
      id: s.id,
      admin_id: s.admin_id,
      admin_email: admin?.email ?? null,
      admin_name: admin?.full_name ?? null,
      admin_role: admin?.role ?? null,
      device_info: s.device_info ?? null,
      ip: s.ip ?? null,
      last_activity: s.last_activity,
      created_at: s.created_at,
    }
  })

  return NextResponse.json({ sessions: enriched })
}

type RevokePayload = {
  sessionId?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as RevokePayload
  const sessionId = body.sessionId?.trim()

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const { data: session, error: fetchError } = await auth.supabase
    .from('admin_sessions')
    .select('id, admin_id, ip, device_info, created_at, last_activity')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { error: deleteError } = await auth.supabase
    .from('admin_sessions')
    .delete()
    .eq('id', sessionId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'STAFF_SESSION_REVOKE',
    target_id: session.admin_id,
    details: `Revoked session ${session.id} (IP: ${session.ip ?? 'unknown'}, device: ${session.device_info ?? 'n/a'})`,
  })

  return NextResponse.json({ ok: true })
}

