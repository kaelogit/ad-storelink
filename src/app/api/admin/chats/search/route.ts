import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const userId = (searchParams.get('userId') || '').trim() || null
  const partnerId = (searchParams.get('partnerId') || '').trim() || null
  const chatId = (searchParams.get('chatId') || '').trim() || null
  const q = (searchParams.get('q') || '').trim() || null
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  if (!userId && !chatId && !q) {
    return NextResponse.json(
      { error: 'Provide userId, chatId, or q (slug/name/email search)' },
      { status: 400 },
    )
  }

  const { data, error } = await auth.supabase.rpc('search_admin_p2p_chats', {
    p_user_id: userId,
    p_partner_id: partnerId,
    p_chat_id: chatId,
    p_q: q,
    p_limit: Number.isFinite(limit) ? limit : 50,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    const msg = error.message || 'Could not search chats'
    const lower = msg.toLowerCase()
    if (lower.includes('admin access')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const rows = Array.isArray(data) ? data : []

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'P2P_CHAT_SEARCH',
    target_id: chatId || userId || partnerId || null,
    details: {
      message: 'Admin searched P2P chat threads.',
      userId,
      partnerId,
      chatId,
      q,
      resultCount: rows.length,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({ rows })
}
