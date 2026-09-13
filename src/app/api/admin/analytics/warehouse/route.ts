import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const country = (url.searchParams.get('country') || 'ALL').trim().toUpperCase()
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365))

  const { data, error } = await auth.supabase.rpc('get_admin_analytics_warehouse', {
    p_country_code: country || 'ALL',
    p_days: Number.isFinite(days) ? days : 30,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ANALYTICS_WAREHOUSE_VIEW',
    target_id: country || 'ALL',
    details: {
      message: 'Admin viewed analytics warehouse.',
      days,
      country,
    },
  })

  return NextResponse.json(data ?? {})
}
