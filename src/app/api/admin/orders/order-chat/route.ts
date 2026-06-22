import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import type { DisputeChatMessageRow } from '../../../../../utils/disputeChat'

type Body = {
  orderId?: string
  /** super_admin / moderator only: load thread when dispute is no longer "active" */
  overrideDisputeGate?: boolean
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const orderId = body.orderId?.trim()
  const overrideDisputeGate = body.overrideDisputeGate === true

  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  if (overrideDisputeGate && !['super_admin', 'moderator'].includes(auth.role)) {
    return NextResponse.json(
      { error: 'overrideDisputeGate is only allowed for super_admin or moderator' },
      { status: 403 },
    )
  }

  const { data, error } = await auth.supabase.rpc('admin_get_product_order_dispute_chat', {
    p_order_id: orderId,
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
    action_type: 'DISPUTE_ORDER_CHAT_VIEW',
    target_id: orderId,
    details: {
      message: 'Admin viewed product order chat for dispute resolution.',
      orderId,
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
