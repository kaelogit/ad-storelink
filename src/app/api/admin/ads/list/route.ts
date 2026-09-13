import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content', 'analyst', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || null
  const country = searchParams.get('country') || null
  const advertiserType = searchParams.get('advertiserType') || null
  const q = searchParams.get('q') || null
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  const { data, error } = await auth.supabase.rpc('admin_list_ad_campaigns', {
    p_status: status,
    p_country_code: country,
    p_advertiser_type: advertiserType,
    p_search: q,
    p_limit: Number.isFinite(limit) ? limit : 50,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const payload = (data ?? { ok: true, campaigns: [] }) as {
    campaigns?: Record<string, unknown>[]
    [key: string]: unknown
  }
  const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : []
  const sellerIds = Array.from(
    new Set(
      campaigns
        .map((c) => (typeof c.seller_id === 'string' ? c.seller_id : null))
        .filter(Boolean) as string[],
    ),
  )

  let logosById: Record<string, string | null> = {}
  if (sellerIds.length > 0) {
    const { data: profiles } = await auth.supabase
      .from('profiles')
      .select('id, logo_url')
      .in('id', sellerIds)
    logosById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.logo_url ?? null]))
  }

  return NextResponse.json({
    ...payload,
    campaigns: campaigns.map((c) => ({
      ...c,
      seller_logo_url:
        typeof c.seller_id === 'string' ? logosById[c.seller_id] ?? null : null,
    })),
  })
}
