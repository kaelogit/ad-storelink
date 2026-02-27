import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const actionType = searchParams.get('action_type') ?? ''

  let query = auth.supabase
    .from('admin_audit_logs')
    .select('id, admin_id, admin_email, action_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (actionType) query = query.eq('action_type', actionType)

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const headers = ['created_at', 'admin_email', 'action_type', 'target_id', 'details']
  const escape = (s: string) =>
    s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  const csvLines = [
    headers.join(','),
    ...(rows ?? []).map((r: Record<string, unknown>) =>
      headers.map((h) => escape(r[h] != null ? String(r[h]) : '')).join(',')
    ),
  ]
  const csv = csvLines.join('\n')
  const filename = `audit-log-${from || 'all'}-${to || 'all'}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
