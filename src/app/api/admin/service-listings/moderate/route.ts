import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ModerateServicePayload = {
  listingId?: string
  isActive?: boolean
  reasonCategory?: string
  reason?: string
}

const REASON_CATEGORIES = new Set([
  'policy_violation',
  'fraud',
  'copyright',
  'seller_request',
  'quality_issue',
  'other',
])

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support', 'finance'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as ModerateServicePayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const listingId = body.listingId?.trim()
  const isActive = body.isActive
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!listingId || typeof isActive !== 'boolean' || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'listingId, isActive, reasonCategory and reason are required' },
      { status: 400 }
    )
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }
  if (!REASON_CATEGORIES.has(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'SERVICE_LISTING_MODERATION')
    .eq('target_id', listingId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: existingListing, error: listingErr } = await auth.supabase
    .from('service_listings')
    .select('id, seller_id, is_active, title')
    .eq('id', listingId)
    .maybeSingle()

  if (listingErr || !existingListing) {
    return NextResponse.json({ error: 'Service listing not found' }, { status: 404 })
  }
  if (Boolean(existingListing.is_active) === isActive) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { error: updateError } = await auth.supabase
    .from('service_listings')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SERVICE_LISTING_MODERATION',
    target_id: listingId,
    details: {
      message: 'Service listing moderation action applied.',
      listingId,
      sellerId: existingListing.seller_id,
      listingTitle: existingListing.title,
      fromActive: Boolean(existingListing.is_active),
      toActive: isActive,
      reasonCategory,
      reason,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true, isActive })
}
