import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export type LoyaltySellerRow = {
  seller_id: string
  display_name: string | null
  slug: string | null
  email: string | null
  is_seller: boolean
  loyalty_enabled: boolean
  loyalty_percentage: number
  loyalty_max_percentage: number | null
  effective_percentage: number
  platform_max_percentage: number
  loyalty_coins_issued: number
  completed_orders_count: number
  updated_at: string | null
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support', 'analyst', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const enabledOnly = url.searchParams.get('enabled') === '1'
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 300))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const [{ data: rows, error }, { data: config, error: configError }] = await Promise.all([
    auth.supabase.rpc('get_admin_loyalty_sellers', {
      p_query: q || null,
      p_enabled_only: enabledOnly,
      p_limit: limit,
      p_offset: offset,
    }),
    auth.supabase.rpc('get_loyalty_program_config'),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 400 })
  }

  const sellerRows = (Array.isArray(rows) ? rows : []) as LoyaltySellerRow[]
  const enabledCount = sellerRows.filter((r) => r.loyalty_enabled).length

  return NextResponse.json({
    rows: sellerRows,
    config: config ?? null,
    stats: {
      listed: sellerRows.length,
      enabledInView: enabledCount,
    },
    pagination: { limit, offset },
  })
}
