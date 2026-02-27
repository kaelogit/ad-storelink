import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type SupportReplyPayload = {
  ticketId?: string
  message?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'support', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as SupportReplyPayload
  const ticketId = body.ticketId?.trim()
  const message = body.message?.trim()

  if (!ticketId || !message) {
    return NextResponse.json({ error: 'ticketId and message are required' }, { status: 400 })
  }

  const { error: messageError } = await auth.supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: auth.userId,
    is_admin_reply: true,
    message,
  })

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 400 })
  }

  // Update ticket status and admin_reply so the app shows the reply (app reads support_tickets.admin_reply)
  const { error: ticketError } = await auth.supabase
    .from('support_tickets')
    .update({ status: 'PENDING', admin_reply: message })
    .eq('id', ticketId)

  if (ticketError) {
    return NextResponse.json({ error: ticketError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SUPPORT_REPLY',
    target_id: ticketId,
    details: 'Sent support ticket reply and moved ticket to PENDING.',
  })

  return NextResponse.json({ ok: true })
}
