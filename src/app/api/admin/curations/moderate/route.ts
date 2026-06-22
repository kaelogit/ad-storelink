import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ModerateBody = {
  curatorId?: string
  hubKind?: string
  hubRefId?: string
  action?: 'hide' | 'unhide' | 'feature' | 'unfeature'
  reasonCategory?: string
  reason?: string
}

const REASON_CATEGORIES = new Set([
  'policy_violation',
  'quality_issue',
  'privacy_request',
  'editorial_feature',
  'editorial_unfeature',
  'abuse',
  'other',
])

const ACTION_TYPES: Record<string, string> = {
  hide: 'CURATION_HIDE',
  unhide: 'CURATION_UNHIDE',
  feature: 'CURATION_FEATURE',
  unfeature: 'CURATION_UNFEATURE',
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ModerateBody
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const curatorId = body.curatorId?.trim()
  const hubKind = body.hubKind?.trim().toLowerCase()
  const hubRefId = body.hubRefId?.trim()
  const action = body.action
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!curatorId || !hubKind || !hubRefId || !action) {
    return NextResponse.json(
      { error: 'curatorId, hubKind, hubRefId, and action are required' },
      { status: 400 },
    )
  }
  if (!['product', 'service'].includes(hubKind)) {
    return NextResponse.json({ error: 'hubKind must be product or service' }, { status: 400 })
  }
  if (!ACTION_TYPES[action]) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const needsReason = action === 'hide' || action === 'feature'
  if (needsReason) {
    if (!reasonCategory || !reason) {
      return NextResponse.json(
        { error: 'reasonCategory and reason are required for hide and feature actions' },
        { status: 400 },
      )
    }
    if (!REASON_CATEGORIES.has(reasonCategory)) {
      return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
    }
    if (reason.length < 10) {
      return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
    }
  }

  const targetId = `${curatorId}:${hubKind}:${hubRefId}`
  const actionType = ACTION_TYPES[action]

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', actionType)
    .eq('target_id', targetId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: hub, error } = await auth.supabase.rpc('admin_moderate_curation_hub', {
    p_curator_id: curatorId,
    p_hub_kind: hubKind,
    p_hub_ref_id: hubRefId,
    p_action: action,
    p_reason: reason || null,
  })

  if (error) {
    const msg = error.message || 'Moderation failed'
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.toLowerCase().includes('requires')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: actionType,
    target_id: targetId,
    details: {
      message: `Curation hub ${action} applied.`,
      curatorId,
      hubKind,
      hubRefId,
      action,
      reasonCategory: reasonCategory || null,
      reason: reason || null,
      idempotencyKey,
      hub,
    },
  })

  return NextResponse.json({ ok: true, hub })
}
