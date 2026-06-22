import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import type { DisputeChatMessageRow } from '../../../../../utils/disputeChat'

type Body = {
  chatId?: string
  maxMessages?: number
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const chatId = body.chatId?.trim()
  const maxMessages = Number(body.maxMessages || 500)

  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('admin_get_p2p_chat_transcript', {
    p_chat_id: chatId,
    p_max_messages: Number.isFinite(maxMessages) ? maxMessages : 500,
  })

  if (error) {
    const msg = error.message || 'Could not load chat'
    const lower = msg.toLowerCase()
    if (lower.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (lower.includes('admin access')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const messages = (Array.isArray(data) ? data : []) as DisputeChatMessageRow[]

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'P2P_CHAT_TRANSCRIPT_VIEW',
    target_id: chatId,
    details: {
      message: 'Admin viewed P2P chat transcript for trust & safety.',
      chatId,
      messageCount: messages.length,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({
    ok: true,
    conversationId: chatId,
    messages,
  })
}
