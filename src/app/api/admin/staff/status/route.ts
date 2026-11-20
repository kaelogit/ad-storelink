import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type StaffStatusPayload = {
  staffId?: string
  isActive?: boolean
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as StaffStatusPayload
  const staffId = body.staffId?.trim()
  const isActive = body.isActive

  if (!staffId || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'staffId and isActive are required' }, { status: 400 })
  }

  const { data: staff } = await auth.supabase
    .from('admin_users')
    .select('role, email')
    .eq('id', staffId)
    .single()

  if (!staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  if (staff.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot modify super_admin access state' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('admin_users')
    .update({ is_active: isActive })
    .eq('id', staffId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  let sessionsRevoked = 0
  if (!isActive) {
    const { data: revoked, error: sessionError } = await auth.supabase
      .from('admin_sessions')
      .delete()
      .eq('admin_id', staffId)
      .select('id')

    if (sessionError) {
      const msg = sessionError.message ?? ''
      if (!(msg.includes('admin_sessions') || msg.includes('does not exist') || msg.includes('schema cache'))) {
        return NextResponse.json({ error: sessionError.message }, { status: 400 })
      }
    } else {
      sessionsRevoked = revoked?.length ?? 0
    }
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: isActive ? 'STAFF_ACTIVATED' : 'STAFF_SUSPENDED',
    target_id: staffId,
    details: {
      message: `${isActive ? 'Activated' : 'Suspended'} staff access.`,
      staffId,
      staffEmail: staff.email,
      is_active: isActive,
      sessionsRevoked,
    },
  })

  return NextResponse.json({ ok: true, sessionsRevoked })
}
