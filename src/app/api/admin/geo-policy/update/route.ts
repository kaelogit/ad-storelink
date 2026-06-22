import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  mode?: 'strict_same_country' | 'allow_pairs' | 'open'
  allowedPairs?: Array<{ viewer: string; seller: string }>
  blockSurfaces?: Record<string, boolean>
  messageTitle?: string | null
  messageBody?: string | null
  notes?: string | null
  reason?: string
}

const VALID_MODES = new Set(['strict_same_country', 'allow_pairs', 'open'])
const VALID_SURFACES = new Set(['app_deep_link', 'checkout', 'chat', 'discovery'])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const mode = body.mode?.trim()
  const reason = body.reason?.trim()

  if (!mode || !VALID_MODES.has(mode)) {
    return NextResponse.json({ error: 'Valid mode is required' }, { status: 400 })
  }
  if (!reason || reason.length < 10) {
    return NextResponse.json({ error: 'reason is required (min 10 characters)' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'GEO_POLICY_CHANGE')
    .eq('target_id', 'default')
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const allowedPairs = Array.isArray(body.allowedPairs)
    ? body.allowedPairs
        .map((pair) => ({
          viewer: pair.viewer?.trim().toUpperCase(),
          seller: pair.seller?.trim().toUpperCase(),
        }))
        .filter((pair) => pair.viewer && pair.seller)
    : []

  const blockSurfaces: Record<string, boolean> = {}
  if (body.blockSurfaces && typeof body.blockSurfaces === 'object') {
    for (const [key, value] of Object.entries(body.blockSurfaces)) {
      if (VALID_SURFACES.has(key)) blockSurfaces[key] = Boolean(value)
    }
  }

  const { data: result, error } = await auth.supabase.rpc('admin_update_geo_visibility_config', {
    p_mode: mode,
    p_allowed_pairs: allowedPairs,
    p_block_surfaces: Object.keys(blockSurfaces).length > 0 ? blockSurfaces : null,
    p_message_title: body.messageTitle?.trim() || null,
    p_message_body: body.messageBody?.trim() || null,
    p_notes: body.notes?.trim() || null,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'GEO_POLICY_CHANGE',
    target_id: 'default',
    details: {
      message: 'Geo visibility policy updated.',
      mode,
      allowedPairs,
      blockSurfaces: Object.keys(blockSurfaces).length > 0 ? blockSurfaces : null,
      messageTitle: body.messageTitle?.trim() || null,
      messageBody: body.messageBody?.trim() || null,
      notes: body.notes?.trim() || null,
      reason,
      idempotencyKey,
      result,
    },
  })

  return NextResponse.json(result ?? { ok: true })
}
