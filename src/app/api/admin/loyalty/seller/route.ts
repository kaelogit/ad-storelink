import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  sellerId?: string
  loyaltyMaxPercentage?: number | null
  loyaltyEnabled?: boolean
  loyaltyPercentage?: number
  clearSellerCap?: boolean
  reasonCategory?: string
  reason?: string
}

const REASON_CATEGORIES = new Set([
  'policy_cap',
  'fraud_risk',
  'support_request',
  'seller_onboarding',
  'promotion',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const sellerId = body.sellerId?.trim()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!sellerId || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'sellerId, reasonCategory and reason are required' },
      { status: 400 },
    )
  }
  if (!REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'LOYALTY_SELLER_SETTINGS')
    .eq('target_id', sellerId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const auditReason = `[${reasonCategory}] ${reason}`

  const { data: result, error } = await auth.supabase.rpc('admin_update_seller_loyalty_settings', {
    p_seller_id: sellerId,
    p_loyalty_max_percentage:
      body.loyaltyMaxPercentage === null || body.loyaltyMaxPercentage === undefined
        ? null
        : Number(body.loyaltyMaxPercentage),
    p_loyalty_enabled:
      typeof body.loyaltyEnabled === 'boolean' ? body.loyaltyEnabled : null,
    p_loyalty_percentage:
      typeof body.loyaltyPercentage === 'number' ? body.loyaltyPercentage : null,
    p_clear_seller_cap: body.clearSellerCap === true,
    p_reason: auditReason,
  })

  if (error) {
    const msg = error.message || 'Update failed'
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'LOYALTY_SELLER_SETTINGS',
    target_id: sellerId,
    details: {
      message: 'Seller loyalty settings updated by admin.',
      sellerId,
      loyaltyMaxPercentage: body.loyaltyMaxPercentage ?? null,
      loyaltyEnabled: body.loyaltyEnabled ?? null,
      loyaltyPercentage: body.loyaltyPercentage ?? null,
      clearSellerCap: body.clearSellerCap === true,
      reasonCategory,
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json({ ok: true, result })
}
