import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const userId = (searchParams.get('userId') || '').trim()
  const limit = Number(searchParams.get('limit') || 25)
  const offset = Number(searchParams.get('offset') || 0)

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_user_social_saves', {
    p_user_id: userId,
    p_limit: Number.isFinite(limit) ? limit : 25,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    const msg = error.message || 'Could not load saves'
    const lower = msg.toLowerCase()
    if (lower.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (lower.includes('admin access')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const rows = Array.isArray(data) ? data : []

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'USER_SOCIAL_SAVES_VIEW',
    target_id: userId,
    details: {
      message: 'Admin viewed paginated user wishlist/saves sample.',
      userId,
      limit,
      offset,
      rowCount: rows.length,
      adminRole: auth.role,
    },
  })

  return NextResponse.json({ rows })
}
