import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const chatId = (url.searchParams.get('chatId') || '').trim()
  const includePairHistory = url.searchParams.get('includePairHistory') === '1'
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200))

  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_chat_commerce_links', {
    p_chat_id: chatId,
    p_include_pair_history: includePairHistory,
    p_limit: Number.isFinite(limit) ? limit : 50,
  })

  if (error) {
    const msg = error.message || 'Could not load commerce links'
    const lower = msg.toLowerCase()
    if (lower.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const payload = (data || {}) as Record<string, unknown>
  const inThread = (payload.inThread || {}) as Record<string, unknown>
  const pairHistory = (payload.pairHistory || null) as Record<string, unknown> | null

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CHAT_COMMERCE_LINKS_VIEW',
    target_id: chatId,
    details: {
      message: 'Admin viewed orders/bookings linked to chat thread.',
      chatId,
      includePairHistory,
      productOrderCount: Array.isArray(inThread.productOrders) ? inThread.productOrders.length : 0,
      serviceBookingCount: Array.isArray(inThread.serviceBookings) ? inThread.serviceBookings.length : 0,
      pairHistoryProductCount: Array.isArray(pairHistory?.productOrders) ? pairHistory.productOrders.length : 0,
      pairHistoryBookingCount: Array.isArray(pairHistory?.serviceBookings) ? pairHistory.serviceBookings.length : 0,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({
    chatId: payload.chatId,
    buyerId: payload.buyerId,
    sellerId: payload.sellerId,
    inThread: payload.inThread,
    pairHistory: payload.pairHistory,
  })
}
