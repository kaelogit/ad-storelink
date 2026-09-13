import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

const OUTCOMES = new Set(['true_positive', 'false_positive', 'inconclusive'])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { flagId?: string; outcome?: string; note?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const flagId = typeof body.flagId === 'string' ? body.flagId.trim() : ''
  const outcome = typeof body.outcome === 'string' ? body.outcome.trim().toLowerCase() : ''
  const note = typeof body.note === 'string' ? body.note.trim() || null : null

  if (!flagId || !OUTCOMES.has(outcome)) {
    return NextResponse.json(
      { error: 'flagId and outcome (true_positive | false_positive | inconclusive) are required.' },
      { status: 400 },
    )
  }

  const { data, error } = await auth.supabase.rpc('resolve_content_policy_flag', {
    p_flag_id: flagId,
    p_outcome: outcome,
    p_admin_id: auth.userId,
    p_note: note,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'CONTENT_POLICY_FLAG_RESOLVE',
    target_id: flagId,
    details: {
      message: 'Admin resolved a borderline content-policy flag.',
      adminRole: auth.role,
      outcome,
      note,
      result: data ?? null,
    },
  })

  return NextResponse.json({ ok: true, result: data ?? null })
}
