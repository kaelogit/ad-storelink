import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type AccountStatusPayload = {
  userId?: string
  accountStatus?: 'active' | 'suspended'
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as AccountStatusPayload
  const userId = body.userId?.trim()
  const accountStatus = body.accountStatus
  const reason = body.reason?.trim()

  if (!userId || !accountStatus || !reason) {
    return NextResponse.json(
      { error: 'userId, accountStatus and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('profiles')
    .update({ account_status: accountStatus })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'USER_STATUS_CHANGE',
    target_id: userId,
    details: `Changed account status to ${accountStatus}. Reason: ${reason}`,
  })

  return NextResponse.json({ ok: true })
}
