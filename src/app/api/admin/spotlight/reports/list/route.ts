import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || 'open').trim().toLowerCase()
  const q = (searchParams.get('q') || '').trim()
  const limit = Number(searchParams.get('limit') || 100)
  const offset = Number(searchParams.get('offset') || 0)

  const { data, error } = await auth.supabase.rpc('get_spotlight_reports_admin', {
    p_status: status,
    p_q: q || null,
    p_limit: Number.isFinite(limit) ? limit : 100,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ rows: Array.isArray(data) ? data : [] })
}
