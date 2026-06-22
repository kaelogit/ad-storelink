import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  policyType?: 'terms' | 'privacy' | 'service_policies'
  countryCode?: string
  surface?: 'app' | 'web' | 'storefront'
  format?: 'structured_json' | 'markdown' | 'html'
  title?: string
  effectiveLabel?: string
  intro?: string
  body?: unknown
  reason?: string
}

const VALID_TYPES = new Set(['terms', 'privacy', 'service_policies'])
const VALID_SURFACES = new Set(['app', 'web', 'storefront'])
const VALID_FORMATS = new Set(['structured_json', 'markdown', 'html'])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const policyType = body.policyType?.trim()
  const reason = body.reason?.trim()

  if (!policyType || !VALID_TYPES.has(policyType)) {
    return NextResponse.json({ error: 'Valid policyType is required' }, { status: 400 })
  }
  if (!reason || reason.length < 10) {
    return NextResponse.json({ error: 'reason is required (min 10 characters)' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }
  if (body.body == null) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const surface = body.surface || 'app'
  const format = body.format || 'structured_json'
  if (!VALID_SURFACES.has(surface)) {
    return NextResponse.json({ error: 'Invalid surface' }, { status: 400 })
  }
  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

  const countryCode =
    policyType === 'service_policies'
      ? 'GLOBAL'
      : (body.countryCode || 'NG').trim().toUpperCase()

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'LEGAL_POLICY_PUBLISH')
    .eq('target_id', `${policyType}:${countryCode}:${surface}`)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const normalizedBody =
    format === 'structured_json' && typeof body.body === 'object'
      ? body.body
      : typeof body.body === 'string'
        ? body.body
        : body.body

  const { data: result, error } = await auth.supabase.rpc('admin_publish_legal_policy', {
    p_policy_type: policyType,
    p_country_code: countryCode,
    p_surface: surface,
    p_format: format,
    p_title: body.title?.trim() || null,
    p_effective_label: body.effectiveLabel?.trim() || null,
    p_intro: body.intro?.trim() || null,
    p_body: normalizedBody,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'LEGAL_POLICY_PUBLISH',
    target_id: `${policyType}:${countryCode}:${surface}`,
    details: {
      message: 'Legal policy published.',
      policyType,
      countryCode,
      surface,
      format,
      title: body.title?.trim() || null,
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json(result ?? { ok: true })
}
