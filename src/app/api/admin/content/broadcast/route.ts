import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type BroadcastPayload = {
  title?: string
  message?: string
  segment?: 'ALL' | 'SELLERS' | 'BUYERS'
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as BroadcastPayload
  const title = body.title?.trim()
  const message = body.message?.trim()
  const segment = body.segment

  if (!title || !message || !segment) {
    return NextResponse.json({ error: 'title, message and segment are required' }, { status: 400 })
  }

  const { error } = await auth.supabase.rpc('send_broadcast_notification', {
    p_title: title,
    p_message: message,
    p_segment: segment,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'BROADCAST_SENT',
    details: `Sent "${title}" to ${segment}`,
  })

  return NextResponse.json({ ok: true })
}
