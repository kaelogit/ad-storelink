import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ListRpcRow = {
  id: string
  status: 'open' | 'paid' | 'waived'
  currency_code: string
  amount_minor: number
  reason: string | null
  paid_reference: string | null
  created_at: string
  paid_at: string | null
  updated_at: string
  admin_note: string | null
  admin_note_category: string | null
  service_order_id: string
  order_id: string
  seller_id: string
  seller_name: string | null
  seller_slug: string | null
  seller_country: string | null
  buyer_id: string
  buyer_name: string | null
  buyer_slug: string | null
  age_days: number
}

type StatsPayload = {
  openCount: number
  paidCount: number
  waivedCount: number
  overdueOpenCount: number
  aging: {
    bucket0_7: number
    bucket8_30: number
    bucket31Plus: number
  }
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'open').trim().toLowerCase()
  const q = (url.searchParams.get('q') || '').trim()
  const aging = (url.searchParams.get('aging') || 'all').trim().toLowerCase()
  const country = (url.searchParams.get('country') || '').trim().toUpperCase()
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 300))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const { data, error } = await auth.supabase.rpc('get_admin_clawback_debts', {
    p_status: status === 'all' ? null : status,
    p_query: q || null,
    p_aging: aging === 'all' ? null : aging,
    p_country_code: country || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const { data: stats, error: statsError } = await auth.supabase.rpc('get_admin_clawback_debt_stats', {
    p_country_code: country || null,
  })
  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 400 })
  }

  return NextResponse.json({
    rows: (Array.isArray(data) ? data : []) as ListRpcRow[],
    stats: (stats || {}) as StatsPayload,
    pagination: { limit, offset },
  })
}
