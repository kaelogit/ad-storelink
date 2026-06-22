import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const category = (url.searchParams.get('category') || 'all').trim().toLowerCase()

  const { data, error } = await auth.supabase.rpc('get_admin_feature_flags', {
    p_query: q || null,
    p_category: category === 'all' ? null : category,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const payload = (data ?? {}) as { flags?: unknown[] }
  return NextResponse.json({
    flags: Array.isArray(payload.flags) ? payload.flags : [],
    role: auth.role,
  })
}
