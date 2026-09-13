import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 100))

  const { data, error } = await auth.supabase.rpc('get_admin_listing_content_integrity', {
    p_limit: Number.isFinite(limit) ? limit : 50,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'LISTING_CONTENT_INTEGRITY_VIEW',
    target_id: 'queue',
    details: {
      message: 'Admin viewed listing content integrity desk.',
      adminRole: auth.role,
      summary: (data as Record<string, unknown>)?.summary ?? null,
    },
  })

  return NextResponse.json(data ?? {})
}
