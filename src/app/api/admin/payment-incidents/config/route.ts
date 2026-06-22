import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ConfigBody = {
  alertWindowHours?: number
  alertErrorThreshold?: number
  stuckOrderMinAgeMinutes?: number
  deskLookbackHours?: number
  notes?: string | null
  reason?: string
}

export async function GET() {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_payment_incident_config')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? {})
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ConfigBody
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const reason = body.reason?.trim()

  if (!reason || reason.length < 10) {
    return NextResponse.json({ error: 'reason is required (min 10 characters)' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'PAYMENT_INCIDENT_CONFIG_CHANGE')
    .eq('target_id', 'default')
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data, error } = await auth.supabase.rpc('admin_update_payment_incident_config', {
    p_alert_window_hours: Number(body.alertWindowHours ?? 1),
    p_alert_error_threshold: Number(body.alertErrorThreshold ?? 3),
    p_stuck_order_min_age_minutes: Number(body.stuckOrderMinAgeMinutes ?? 30),
    p_desk_lookback_hours: Number(body.deskLookbackHours ?? 168),
    p_notes: body.notes?.trim() || null,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'PAYMENT_INCIDENT_CONFIG_CHANGE',
    target_id: 'default',
    details: {
      message: 'Payment incident alert thresholds updated.',
      alertWindowHours: body.alertWindowHours,
      alertErrorThreshold: body.alertErrorThreshold,
      stuckOrderMinAgeMinutes: body.stuckOrderMinAgeMinutes,
      deskLookbackHours: body.deskLookbackHours,
      notes: body.notes?.trim() || null,
      reason,
      idempotencyKey,
    },
  })

  return NextResponse.json(data ?? { ok: true })
}
