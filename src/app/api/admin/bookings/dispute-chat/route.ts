import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  serviceOrderId?: string
  /** super_admin / moderator only: load thread when dispute is no longer "active" */
  overrideDisputeGate?: boolean
}

export type DisputeChatMessageRow = {
  message_id: string
  conversation_id: string
  sender_id: string | null
  sender_display_name: string | null
  sender_role: string | null
  created_at: string | null
  text: string | null
  type: string | null
  image_url: string | null
  gif_url: string | null
  audio_url: string | null
  audio_duration_seconds: number | null
  video_url: string | null
  document_url: string | null
  document_name: string | null
  reply_to_snippet: string | null
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const serviceOrderId = body.serviceOrderId?.trim()
  const overrideDisputeGate = body.overrideDisputeGate === true

  if (!serviceOrderId) {
    return NextResponse.json({ error: 'serviceOrderId is required' }, { status: 400 })
  }

  if (overrideDisputeGate && !['super_admin', 'moderator'].includes(auth.role)) {
    return NextResponse.json(
      { error: 'overrideDisputeGate is only allowed for super_admin or moderator' },
      { status: 403 },
    )
  }

  const { data, error } = await auth.supabase.rpc('admin_get_service_booking_dispute_chat', {
    p_service_order_id: serviceOrderId,
    p_max_messages: 500,
    p_override_dispute_gate: overrideDisputeGate,
  })

  if (error) {
    const msg = error.message || 'Could not load chat'
    const lower = msg.toLowerCase()
    if (lower.includes('not found') || lower.includes('no chat linked')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (lower.includes('only available') || lower.includes('override requires')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const messages = (Array.isArray(data) ? data : []) as DisputeChatMessageRow[]
  const conversationId = messages[0]?.conversation_id ?? null

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'DISPUTE_BOOKING_CHAT_VIEW',
    target_id: serviceOrderId,
    details: {
      message: 'Admin viewed booking chat for dispute resolution.',
      serviceOrderId,
      conversationId,
      messageCount: messages.length,
      overrideDisputeGate,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({
    ok: true,
    conversationId,
    messages,
  })
}
