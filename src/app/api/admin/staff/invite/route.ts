import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import type { AdminRole } from '../../../../../types/admin'

type StaffInvitePayload = {
  email?: string
  fullName?: string
  role?: AdminRole
}

const ALLOWED_ROLES = new Set<AdminRole>(['moderator', 'finance', 'support', 'content'])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as StaffInvitePayload
  const email = body.email?.trim().toLowerCase()
  const fullName = body.fullName?.trim()
  const role = body.role

  if (!email || !fullName || !role) {
    return NextResponse.json({ error: 'email, fullName and role are required' }, { status: 400 })
  }

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: 'Invalid role for staff invite' }, { status: 400 })
  }

  const { data: userId, error: rpcError } = await auth.supabase.rpc('get_user_id_by_email', {
    p_email: email,
  })

  if (rpcError || !userId) {
    return NextResponse.json(
      { error: 'User not found. They must sign up on the app first.' },
      { status: 404 }
    )
  }

  const { error: insertError } = await auth.supabase.from('admin_users').insert({
    id: userId,
    email,
    full_name: fullName,
    role,
    is_active: true,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'STAFF_INVITE',
    target_id: userId,
    details: `Granted ${role} admin role to ${email}.`,
  })

  return NextResponse.json({ ok: true })
}
