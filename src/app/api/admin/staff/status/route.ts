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

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: isActive ? 'STAFF_ACTIVATED' : 'STAFF_SUSPENDED',
    target_id: staffId,
    details: `${isActive ? 'Activated' : 'Suspended'} access for staff: ${staff.email}`,
  })

  return NextResponse.json({ ok: true })
}
