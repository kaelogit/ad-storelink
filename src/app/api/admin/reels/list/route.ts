import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const scope = (searchParams.get('scope') || 'discover_eligible').trim().toLowerCase()
  const q = (searchParams.get('q') || '').trim()
  const limit = Number(searchParams.get('limit') || 100)
  const offset = Number(searchParams.get('offset') || 0)

  const [listResult, summaryResult] = await Promise.all([
    auth.supabase.rpc('get_admin_discover_feed_reels', {
      p_scope: scope,
      p_q: q || null,
      p_limit: Number.isFinite(limit) ? limit : 100,
      p_offset: Number.isFinite(offset) ? offset : 0,
    }),
    auth.supabase.rpc('get_admin_discover_feed_summary'),
  ])

  if (listResult.error) {
    return NextResponse.json({ error: listResult.error.message }, { status: 400 })
  }

  if (summaryResult.error) {
    return NextResponse.json({ error: summaryResult.error.message }, { status: 400 })
  }

  return NextResponse.json({
    rows: Array.isArray(listResult.data) ? listResult.data : [],
    summary: summaryResult.data ?? null,
  })
}
