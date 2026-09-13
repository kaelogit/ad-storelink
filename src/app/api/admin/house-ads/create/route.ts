import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type CreateBody = {
  name?: string
  imageUrl?: string
  headline?: string
  deeplink?: string
  placements?: string[]
  countryCode?: string
  startAt?: string | null
  endAt?: string | null
  activate?: boolean
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as CreateBody
  const imageUrl = body.imageUrl?.trim()
  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  const placements = Array.isArray(body.placements)
    ? body.placements.filter((p) => p === 'discover_tile' || p === 'home_card')
    : ['discover_tile', 'home_card']

  const { data, error } = await auth.supabase.rpc('admin_create_house_ad_campaign', {
    p_name: body.name?.trim() || body.headline?.trim() || 'StoreLink house ad',
    p_image_url: imageUrl,
    p_headline: body.headline?.trim() || null,
    p_deeplink: body.deeplink?.trim() || null,
    p_placements: placements.length ? placements : ['discover_tile', 'home_card'],
    p_country_code: body.countryCode?.trim() || 'NG',
    p_start_at: body.startAt || null,
    p_end_at: body.endAt || null,
    p_activate: body.activate !== false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
