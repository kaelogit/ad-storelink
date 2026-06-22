import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type CoinDirection = 'credit' | 'debit'

type CoinAdjustPayload = {
  userId?: string
  direction?: CoinDirection
  amount?: number
  reasonCategory?: string
  reason?: string
}

const CREDIT_CATEGORIES = new Set([
  'refund_goodwill',
  'fraud_reversal',
  'promotion',
  'billing_error',
  'support_resolution',
  'compensation',
  'other',
])

const DEBIT_CATEGORIES = new Set([
  'fraud_clawback',
  'billing_error',
  'policy_violation',
  'duplicate_credit',
  'customer_request',
  'operations_error',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as CoinAdjustPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const userId = body.userId?.trim()
  const direction = body.direction
  const amount = Math.floor(Number(body.amount ?? 0))
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!userId || !direction || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'userId, direction, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (direction !== 'credit' && direction !== 'debit') {
    return NextResponse.json({ error: 'direction must be credit or debit' }, { status: 400 })
  }

  const allowedCategories = direction === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES
  if (!allowedCategories.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category for direction' }, { status: 400 })
  }

  if (amount < 1 || amount > 1_000_000) {
    return NextResponse.json({ error: 'amount must be between 1 and 1,000,000' }, { status: 400 })
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
    .eq('action_type', 'COIN_ADJUSTMENT')
    .eq('target_id', userId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('id, coin_balance')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: rpcResult, error: rpcError } = await auth.supabase.rpc('admin_adjust_user_coins', {
    p_user_id: userId,
    p_direction: direction,
    p_amount: amount,
    p_reason_category: reasonCategory,
    p_reason: reason,
  })

  if (rpcError) {
    const message = rpcError.message || 'Coin adjustment failed'
    const status = message.includes('INSUFFICIENT_COINS') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'COIN_ADJUSTMENT',
    target_id: userId,
    details: {
      message: `Store Coins ${direction} processed.`,
      userId,
      direction,
      amount,
      reasonCategory,
      reason,
      idempotencyKey,
      balanceBefore: Number(profile.coin_balance ?? 0),
      result: rpcResult,
    },
  })

  return NextResponse.json({
    ok: true,
    direction,
    amount,
    adjustment: rpcResult,
  })
}
