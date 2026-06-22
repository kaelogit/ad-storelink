import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const reportType = (url.searchParams.get('type') || 'all').trim().toLowerCase()
  const status = (url.searchParams.get('status') || 'open').trim().toLowerCase()
  const q = (url.searchParams.get('q') || '').trim()
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 200))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const { data, error } = await auth.supabase.rpc('get_admin_content_reports_inbox', {
    p_report_type: reportType || 'all',
    p_status: status || 'open',
    p_q: q || null,
    p_limit: Number.isFinite(limit) ? limit : 100,
    p_offset: Number.isFinite(offset) ? offset : 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CONTENT_REPORTS_INBOX_VIEW',
    target_id: 'unified',
    details: {
      message: 'Admin viewed unified content reports inbox.',
      adminRole: auth.role,
      reportType,
      status,
      query: q || null,
      summary: (data as Record<string, unknown>)?.summary ?? null,
    },
  })

  return NextResponse.json(data ?? {})
}
