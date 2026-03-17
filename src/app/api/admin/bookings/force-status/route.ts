import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ForceServiceOrderStatusPayload = {
  serviceOrderId?: string
  newStatus?: 'completed' | 'cancelled' | 'refunded'
  reasonCategory?: string
  reason?: string
}

const ALLOWED_STATUSES = new Set(['completed', 'cancelled', 'refunded'])
const REASON_CATEGORIES = new Set([
  'fraud',
  'payment_issue',
  'customer_request',
  'no_show',
  'fulfillment_issue',
  'compliance',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ForceServiceOrderStatusPayload
  const serviceOrderId = body.serviceOrderId?.trim()
  const newStatus = body.newStatus?.toLowerCase()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!serviceOrderId || !newStatus || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'serviceOrderId, newStatus, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  if (!ALLOWED_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: `newStatus must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 400 }
    )
  }

  if (!REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('admin_force_service_order_status', {
    p_service_order_id: serviceOrderId,
    p_new_status: newStatus,
    p_reason_category: reasonCategory,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
