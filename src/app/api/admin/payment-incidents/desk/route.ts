import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 200))

  const { data, error } = await auth.supabase.rpc('get_admin_payment_incident_desk', {
    p_limit: Number.isFinite(limit) ? limit : 100,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'PAYMENT_INCIDENT_DESK_VIEW',
    target_id: 'default',
    details: {
      message: 'Admin viewed Paystack payment incident desk.',
      adminRole: auth.role,
      summary: (data as Record<string, unknown>)?.summary ?? null,
    },
  })

  return NextResponse.json(data ?? {})
}
