import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export type FlashDropRow = {
  listing_type: 'product' | 'service'
  listing_id: string
  title: string
  slug: string | null
  seller_id: string
  seller_slug: string | null
  seller_display_name: string | null
  regular_price: number
  flash_price: number
  price_delta: number
  discount_pct: number
  currency_code: string | null
  flash_end_time: string
  location_country: string | null
  is_active: boolean
  ends_in_minutes: number
  abuse_flags: string[] | null
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'finance', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const countryCode = (searchParams.get('countryCode') || '').trim() || null
  const listingType = (searchParams.get('listingType') || 'all').trim().toLowerCase()
  const q = (searchParams.get('q') || '').trim() || null
  const limit = Number(searchParams.get('limit') || 80)
  const offset = Number(searchParams.get('offset') || 0)

  const { data, error } = await auth.supabase.rpc('get_admin_active_flash_drops', {
    p_country_code: countryCode,
    p_listing_type: listingType,
    p_q: q,
    p_limit: Number.isFinite(limit) ? limit : 80,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ rows: Array.isArray(data) ? data : [] })
}
