import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type SupportResolvePayload = {
  ticketId?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'support', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as SupportResolvePayload
  const ticketId = body.ticketId?.trim()
  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('support_tickets')
    .update({ status: 'RESOLVED' })
    .eq('id', ticketId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SUPPORT_TICKET_RESOLVED',
    target_id: ticketId,
    details: 'Ticket marked as RESOLVED by support admin.',
  })

  return NextResponse.json({ ok: true })
}
