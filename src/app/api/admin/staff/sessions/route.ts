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
    // Table may not exist yet if migration not run; return empty so Super Admin page doesn't crash
    const msg = sessionsError.message ?? ''
    if (msg.includes('admin_sessions') || msg.includes('schema cache') || msg.includes('does not exist')) {
      return NextResponse.json({ sessions: [] })
    }
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
  /** Revoke every active session for this staff member (security reset). */
  staffId?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as RevokePayload
  const sessionId = body.sessionId?.trim()
  const staffId = body.staffId?.trim()

  if (staffId) {
    const { data: staff } = await auth.supabase
      .from('admin_users')
      .select('id, email, role')
      .eq('id', staffId)
      .maybeSingle()

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }
    if (staff.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot force-reset super_admin sessions from this control' }, { status: 403 })
    }

    const { data: revoked, error: deleteError } = await auth.supabase
      .from('admin_sessions')
      .delete()
      .eq('admin_id', staffId)
      .select('id')

    if (deleteError) {
      const msg = deleteError.message ?? ''
      if (msg.includes('admin_sessions') || msg.includes('does not exist') || msg.includes('schema cache')) {
        return NextResponse.json({ ok: true, revokedCount: 0 })
      }
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    const revokedCount = revoked?.length ?? 0
    await auth.supabase.from('admin_audit_logs').insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action_type: 'STAFF_SECURITY_RESET',
      target_id: staffId,
      details: {
        message: 'Forced security reset: revoked all staff sessions.',
        staffId,
        staffEmail: staff.email,
        revokedCount,
      },
    })

    return NextResponse.json({ ok: true, revokedCount })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId or staffId is required' }, { status: 400 })
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
    details: {
      message: 'Revoked staff session.',
      sessionId: session.id,
      ip: session.ip ?? null,
      device_info: session.device_info ?? null,
      admin_id: session.admin_id,
    },
  })

  return NextResponse.json({ ok: true })
}

