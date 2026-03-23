import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type MarkPaidPayload = {
  debtId?: string
  reasonCategory?: string
  reason?: string
  paidReference?: string
}

const REASON_CATEGORIES = new Set([
  'bank_transfer',
  'cash_settlement',
  'wallet_offset',
  'manual_reconciliation',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as MarkPaidPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const debtId = body.debtId?.trim()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()
  const paidReference = body.paidReference?.trim()

  if (!debtId || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'debtId, reasonCategory and reason are required' },
      { status: 400 }
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
    .eq('action_type', 'CLAWBACK_DEBT_MARK_PAID')
    .eq('target_id', debtId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: currentDebt, error: debtErr } = await auth.supabase
    .from('seller_clawback_debts')
    .select('id, status, seller_id, amount_minor, currency_code')
    .eq('id', debtId)
    .maybeSingle()

  if (debtErr || !currentDebt) {
    return NextResponse.json({ error: 'Clawback debt not found' }, { status: 404 })
  }
  if (currentDebt.status === 'paid') {
    return NextResponse.json({ ok: true, idempotent: true, alreadyPaid: true })
  }
  if (currentDebt.status === 'waived') {
    return NextResponse.json({ error: 'Waived debt cannot be marked as paid' }, { status: 409 })
  }

  const finalReference = paidReference || `MANUAL-${Date.now()}-${debtId.slice(0, 8)}`

  const { error: updateError } = await auth.supabase
    .from('seller_clawback_debts')
    .update({
      status: 'paid',
      paid_reference: finalReference,
      paid_at: new Date().toISOString(),
      admin_note: reason,
      admin_note_category: reasonCategory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', debtId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CLAWBACK_DEBT_MARK_PAID',
    target_id: debtId,
    details: {
      message: 'Clawback debt marked paid manually.',
      debtId,
      reasonCategory,
      reason,
      paidReference: finalReference,
      amountMinor: currentDebt.amount_minor,
      currencyCode: currentDebt.currency_code,
      sellerId: currentDebt.seller_id,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true, paidReference: finalReference })
}
