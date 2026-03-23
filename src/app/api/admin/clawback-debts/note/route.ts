import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type DebtNotePayload = {
  debtId?: string
  noteCategory?: string
  note?: string
}

const NOTE_CATEGORIES = new Set([
  'seller_contact',
  'evidence_review',
  'payment_arrangement',
  'legal',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as DebtNotePayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const debtId = body.debtId?.trim()
  const noteCategory = body.noteCategory?.trim()
  const note = body.note?.trim()

  if (!debtId || !noteCategory || !note) {
    return NextResponse.json({ error: 'debtId, noteCategory and note are required' }, { status: 400 })
  }
  if (!NOTE_CATEGORIES.has(noteCategory)) {
    return NextResponse.json({ error: 'Invalid note category' }, { status: 400 })
  }
  if (note.length < 10) {
    return NextResponse.json({ error: 'Note must be at least 10 characters' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'CLAWBACK_DEBT_NOTE')
    .eq('target_id', debtId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: currentDebt, error: debtErr } = await auth.supabase
    .from('seller_clawback_debts')
    .select('id, status, admin_note')
    .eq('id', debtId)
    .maybeSingle()
  if (debtErr || !currentDebt) {
    return NextResponse.json({ error: 'Clawback debt not found' }, { status: 404 })
  }

  const mergedNote = currentDebt.admin_note
    ? `${currentDebt.admin_note}\n\n[${new Date().toISOString()}] ${note}`
    : `[${new Date().toISOString()}] ${note}`

  const { error: updateError } = await auth.supabase
    .from('seller_clawback_debts')
    .update({
      admin_note: mergedNote.slice(0, 4000),
      admin_note_category: noteCategory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', debtId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CLAWBACK_DEBT_NOTE',
    target_id: debtId,
    details: {
      message: 'Clawback debt note updated.',
      debtId,
      noteCategory,
      note,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true })
}
