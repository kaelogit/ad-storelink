import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const country = (url.searchParams.get('country') || 'ALL').trim().toUpperCase()
  const placement = (url.searchParams.get('placement') || 'ALL').trim()
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365))

  const { data, error } = await auth.supabase.rpc('get_admin_ads_warehouse', {
    p_country_code: country || 'ALL',
    p_days: Number.isFinite(days) ? days : 30,
    p_placement: placement || 'ALL',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ADS_WAREHOUSE_VIEW',
    target_id: `${country || 'ALL'}:${placement || 'ALL'}`,
    details: {
      message: 'Admin viewed ads warehouse.',
      days,
      country,
      placement,
    },
  })

  return NextResponse.json(data ?? {})
}
