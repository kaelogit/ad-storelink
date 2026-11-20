import { NextResponse } from 'next/server'
import { getApiAdminContext } from '@/utils/auth/apiAdmin'

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    days?: number
    offset?: number
    limit?: number
    reason?: string
  }
  const days = Math.max(1, Math.min(Number(body.days ?? 90), 180))
  const offset = Math.max(0, Number(body.offset ?? 0))
  const limit = Math.max(1, Math.min(Number(body.limit ?? 14), 31))

  const { data, error } = await auth.supabase.rpc('admin_backfill_analytics_daily_snapshots', {
    p_days: days,
    p_offset: offset,
    p_limit: limit,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const result = (data ?? {}) as {
    done?: boolean
    nextOffset?: number
    processed?: number
    rowsWritten?: number
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'ANALYTICS_WAREHOUSE_BACKFILL',
    target_id: String(days),
    details: {
      message: 'Admin triggered analytics warehouse backfill chunk.',
      days,
      offset,
      limit,
      reason: body.reason ?? null,
      result: data ?? null,
    },
  })

  return NextResponse.json({
    ok: true,
    days,
    offset,
    limit,
    done: result.done === true,
    nextOffset: result.nextOffset ?? offset + limit,
    processed: result.processed ?? 0,
    rowsWritten: result.rowsWritten ?? 0,
  })
}
