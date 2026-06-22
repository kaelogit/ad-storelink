import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type SubscriptionAction =
  | 'grant_diamond'
  | 'extend_diamond'
  | 'downgrade_standard'
  | 'cancel_diamond'
  | 'refund_and_revoke'

type SubscriptionPayload = {
  userId?: string
  action?: SubscriptionAction
  months?: number
  reasonCategory?: string
  reason?: string
  paystackReference?: string
}

const ALLOWED_ACTIONS = new Set<SubscriptionAction>([
  'grant_diamond',
  'extend_diamond',
  'downgrade_standard',
  'cancel_diamond',
  'refund_and_revoke',
])

const REASON_CATEGORIES = new Set([
  'goodwill',
  'billing_error',
  'chargeback',
  'customer_request',
  'fraud_reversal',
  'promotion',
  'support_resolution',
  'other',
])

function toSmallestUnit(amount: number, currencyCode: string): number {
  const code = (currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return Math.round(amount * Math.pow(10, decimals))
}

function getPaystackKey(currencyCode: string): string | null {
  const code = (currencyCode || 'NGN').toUpperCase()
  const suffix =
    code === 'NGN'
      ? 'NG'
      : code === 'GHS'
        ? 'GH'
        : code === 'ZAR'
          ? 'ZA'
          : code === 'KES'
            ? 'KE'
            : code === 'XOF'
              ? 'CI'
              : code === 'EGP'
                ? 'EG'
                : code === 'RWF'
                  ? 'RW'
                  : 'NG'
  return process.env[`PAYSTACK_SECRET_KEY_${suffix}`] ?? (code === 'NGN' ? process.env.PAYSTACK_SECRET_KEY ?? null : null)
}

function isProviderAlreadyRefunded(message: string | undefined): boolean {
  const m = (message || '').toLowerCase()
  return m.includes('already refunded') || m.includes('already been refunded') || m.includes('duplicate')
}

function parsePaystackRef(description: string | null | undefined): string | null {
  if (!description) return null
  const match = description.match(/Paystack ref:\s*(\S+)/i)
  return match?.[1] ?? null
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as SubscriptionPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const userId = body.userId?.trim()
  const action = body.action
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()
  const months = Number(body.months ?? 0)

  if (!userId || !action || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'userId, action, reasonCategory and reason are required' },
      { status: 400 }
    )
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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

  if ((action === 'grant_diamond' || action === 'extend_diamond') && (!months || months < 1 || months > 36)) {
    return NextResponse.json({ error: 'months must be between 1 and 36 for grant/extend' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'SUBSCRIPTION_INTERVENTION')
    .eq('target_id', userId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('id, currency_code, subscription_plan, subscription_expiry, subscription_status, is_seller')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let refundResult: {
    executed: boolean
    paystackReference?: string | null
    amount?: number
    currencyCode?: string
    providerMessage?: string
  } = { executed: false }

  const rpcAction =
    action === 'refund_and_revoke' ? 'cancel_diamond' : action

  if (action === 'refund_and_revoke') {
    const { data: payments, error: payErr } = await auth.supabase
      .from('coin_transactions')
      .select('id, amount, description, created_at')
      .eq('user_id', userId)
      .eq('type', 'SUBSCRIPTION_UPGRADE')
      .order('created_at', { ascending: false })
      .limit(1)

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 400 })
    }

    const latest = payments?.[0]
    const paystackRef =
      body.paystackReference?.trim() ||
      parsePaystackRef(latest?.description) ||
      null

    if (!paystackRef) {
      return NextResponse.json(
        { error: 'No Paystack reference found. Provide paystackReference or ensure a SUBSCRIPTION_UPGRADE payment exists.' },
        { status: 409 }
      )
    }

    const currencyCode = profile.currency_code || 'NGN'
    const amountMain = Number(latest?.amount ?? 0)
    const paystackKey = getPaystackKey(currencyCode)

    if (!paystackKey) {
      return NextResponse.json(
        { error: `Missing Paystack key for ${currencyCode}` },
        { status: 503 }
      )
    }

    if (amountMain <= 0) {
      return NextResponse.json(
        { error: 'Latest subscription payment amount is missing; cannot refund automatically.' },
        { status: 409 }
      )
    }

    const paystackResp = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: paystackRef,
        amount: toSmallestUnit(amountMain, currencyCode),
      }),
    })

    const paystackJson = (await paystackResp.json().catch(() => ({}))) as {
      status?: boolean
      message?: string
    }

    if (!paystackResp.ok || !paystackJson?.status) {
      const providerMessage = paystackJson?.message || 'Paystack refund request failed'
      if (!isProviderAlreadyRefunded(providerMessage)) {
        return NextResponse.json(
          { error: `Refund failed: ${providerMessage}` },
          { status: 409 }
        )
      }
    }

    refundResult = {
      executed: true,
      paystackReference: paystackRef,
      amount: amountMain,
      currencyCode,
    }

    await auth.supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -Math.abs(amountMain),
      type: 'SUBSCRIPTION_REFUND',
      order_id: null,
      description: `Admin refund. Paystack ref: ${paystackRef}. ${reason}`,
    })
  }

  const { data: rpcResult, error: rpcError } = await auth.supabase.rpc('admin_manage_user_subscription', {
    p_user_id: userId,
    p_action: rpcAction,
    p_months: action === 'grant_diamond' || action === 'extend_diamond' ? months : null,
    p_reason_category: reasonCategory,
    p_reason: reason,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message, refund: refundResult }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SUBSCRIPTION_INTERVENTION',
    target_id: userId,
    details: {
      message: `Subscription ${action} processed.`,
      userId,
      action,
      months: action === 'grant_diamond' || action === 'extend_diamond' ? months : null,
      reasonCategory,
      reason,
      idempotencyKey,
      refund: refundResult,
      result: rpcResult,
    },
  })

  return NextResponse.json({
    ok: true,
    action,
    refund: refundResult,
    subscription: rpcResult,
  })
}
