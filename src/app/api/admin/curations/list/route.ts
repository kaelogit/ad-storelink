import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export type CurationHubRow = {
  hub_kind: 'product' | 'service'
  hub_ref_id: string
  curator_user_id: string
  curator_display_name: string | null
  curator_slug: string | null
  curator_email: string | null
  hub_title: string | null
  image_url: string | null
  completed_at: string | null
  order_id: string | null
  is_owner_hidden: boolean
  is_admin_hidden: boolean
  is_featured: boolean
  is_wardrobe_private: boolean
  is_publicly_visible: boolean
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const curatorId = (url.searchParams.get('curatorId') || '').trim() || null
  const hubKind = (url.searchParams.get('kind') || '').trim().toLowerCase() || null
  const hiddenOnly = url.searchParams.get('hidden') === '1'
  const featuredOnly = url.searchParams.get('featured') === '1'
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 300))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const { data, error } = await auth.supabase.rpc('get_admin_curation_hubs', {
    p_query: q || null,
    p_curator_id: curatorId,
    p_hub_kind: hubKind,
    p_hidden_only: hiddenOnly,
    p_featured_only: featuredOnly,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    rows: (Array.isArray(data) ? data : []) as CurationHubRow[],
    pagination: { limit, offset },
  })
}
