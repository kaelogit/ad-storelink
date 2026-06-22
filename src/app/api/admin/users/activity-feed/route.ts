import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import { mirrorActivityFeed } from '../../../../../lib/activityFeedMirror'

type SourcesPayload = Record<string, unknown>

function collectBuyerIds(sources: SourcesPayload): string[] {
  const ids = new Set<string>()
  for (const key of ['cart_add_notifications', 'wishlist_add_notifications'] as const) {
    const rows = sources[key]
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const data = row && typeof row === 'object' ? (row as { data?: { buyer_id?: string } }).data : undefined
      if (data?.buyer_id) ids.add(String(data.buyer_id))
    }
  }
  return [...ids]
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const userId = (searchParams.get('userId') || '').trim()

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_user_activity_sources', {
    p_user_id: userId,
  })

  if (error) {
    const msg = error.message || 'Could not load activity feed'
    const lower = msg.toLowerCase()
    if (lower.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (lower.includes('admin access')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const sources = (data && typeof data === 'object' ? data : {}) as SourcesPayload
  const buyerIds = collectBuyerIds(sources)

  if (buyerIds.length > 0) {
    const { data: buyers } = await auth.supabase
      .from('profiles')
      .select('id, slug, logo_url, subscription_plan')
      .in('id', buyerIds)

    const buyerMap = new Map((buyers || []).map((b) => [String(b.id), b]))

    for (const key of ['cart_add_notifications', 'wishlist_add_notifications'] as const) {
      const rows = sources[key]
      if (!Array.isArray(rows)) continue
      sources[key] = rows.map((row) => {
        if (!row || typeof row !== 'object') return row
        const dataObj = (row as { data?: Record<string, unknown> }).data
        const buyerId = dataObj?.buyer_id ? String(dataObj.buyer_id) : null
        if (!buyerId || !buyerMap.has(buyerId)) return row
        return {
          ...(row as Record<string, unknown>),
          buyer_profile: buyerMap.get(buyerId),
        }
      })
    }
  }

  const mirrored = mirrorActivityFeed(sources, userId)

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'USER_ACTIVITY_FEED_VIEW',
    target_id: userId,
    details: {
      message: 'Admin viewed mobile activity feed mirror for user dossier.',
      userId,
      todayViews: mirrored.todayViews,
      eventCount: mirrored.feed.filter((row) => row.type !== 'SECTION').length,
      adminRole: auth.role,
    },
  })

  return NextResponse.json(mirrored)
}
