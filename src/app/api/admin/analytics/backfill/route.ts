import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as { days?: number; reason?: string }
  const days = Math.max(1, Math.min(Number(body.days ?? 90), 180))

  const { data, error } = await auth.supabase.rpc('admin_backfill_analytics_daily_snapshots', {
    p_days: days,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ANALYTICS_WAREHOUSE_BACKFILL',
    target_id: String(days),
    details: {
      message: 'Admin triggered analytics warehouse backfill.',
      days,
      reason: body.reason ?? null,
      result: data ?? null,
    },
  })

  return NextResponse.json(data ?? { ok: true, days })
}
