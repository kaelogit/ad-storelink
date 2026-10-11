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
  const rawCountry = (searchParams.get('countryCode') || '').trim().toUpperCase()
  const countryCode =
    !rawCountry || rawCountry === 'ALL' || rawCountry === '*' || rawCountry === 'GLOBAL'
      ? null
      : rawCountry
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  const isBrowse = !userId && !chatId && !q
  const mode = isBrowse ? 'browse' : 'search'

  const rpcArgs: Record<string, unknown> = {
    p_limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
    p_offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  }
  if (userId) rpcArgs.p_user_id = userId
  if (partnerId) rpcArgs.p_partner_id = partnerId
  if (chatId) rpcArgs.p_chat_id = chatId
  if (q) rpcArgs.p_q = q
  if (countryCode) rpcArgs.p_country_code = countryCode

  const { data, error } = await auth.supabase.rpc('search_admin_p2p_chats', rpcArgs)

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
    action_type: isBrowse ? 'P2P_CHAT_BROWSE' : 'P2P_CHAT_SEARCH',
    target_id: chatId || userId || partnerId || null,
    details: {
      message: isBrowse
        ? 'Admin browsed recent P2P chat threads.'
        : 'Admin searched P2P chat threads.',
      mode,
      userId,
      partnerId,
      chatId,
      q,
      countryCode,
      resultCount: rows.length,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({ rows, mode })
}
