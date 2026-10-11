import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || 'all').trim().toLowerCase()
  const sourceType = (searchParams.get('sourceType') || '').trim().toLowerCase()
  const q = (searchParams.get('q') || '').trim()
  const limit = Number(searchParams.get('limit') || 100)
  const offset = Number(searchParams.get('offset') || 0)

  const [listRes, countsRes] = await Promise.all([
    auth.supabase.rpc('get_comment_reports_admin', {
      p_status: status,
      p_source_type: sourceType || null,
      p_q: q || null,
      p_limit: Number.isFinite(limit) ? limit : 100,
      p_offset: Number.isFinite(offset) ? offset : 0,
    }),
    auth.supabase.rpc('get_comment_report_counts_admin'),
  ])

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 400 })
  }

  const countsRaw = countsRes.data
  const counts =
    countsRaw && typeof countsRaw === 'object' && !Array.isArray(countsRaw) && !('error' in (countsRaw as object))
      ? countsRaw
      : null

  return NextResponse.json({
    rows: Array.isArray(listRes.data) ? listRes.data : [],
    counts,
  })
}
