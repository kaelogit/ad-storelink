import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../../utils/auth/apiAdmin'

type Body = {
  id?: string
  action?: 'cancel' | 'send_now'
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const id = body.id?.trim()
  const action = body.action
  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const { data: row, error: loadError } = await auth.supabase
    .from('admin_scheduled_announcements')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadError || !row) {
    return NextResponse.json({ error: loadError?.message || 'Announcement not found' }, { status: 404 })
  }

  if (row.status !== 'scheduled') {
    return NextResponse.json({ error: `Cannot ${action} when status is ${row.status}` }, { status: 400 })
  }

  if (action === 'cancel') {
    const { error } = await auth.supabase
      .from('admin_scheduled_announcements')
      .update({
        status: 'cancelled',
        cancel_reason: body.reason?.trim() || 'Cancelled by operator',
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auth.supabase.from('admin_audit_logs').insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action_type: 'ANNOUNCEMENT_CANCELLED',
      target_id: id,
      details: { message: 'Cancelled scheduled announcement.', reason: body.reason || null },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'send_now') {
    const { error: sendError } = await auth.supabase.rpc('send_broadcast_notification', {
      p_title: row.title,
      p_message: row.body,
      p_segment: row.segment,
    })
    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 400 })
    }
    const { error } = await auth.supabase
      .from('admin_scheduled_announcements')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auth.supabase.from('admin_audit_logs').insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action_type: 'BROADCAST_SENT',
      target_id: id,
      details: {
        message: 'Sent scheduled announcement.',
        title: row.title,
        segment: row.segment,
        scheduledId: id,
      },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
