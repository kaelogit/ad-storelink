import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type UnlockServiceListingPayload = {
  listingId?: string
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
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as UnlockServiceListingPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const listingId = body.listingId?.trim()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!listingId || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'listingId, reasonCategory and reason are required' },
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
    .eq('action_type', 'SERVICE_LISTING_CONTENT_UNLOCK')
    .eq('target_id', listingId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: existingListing, error: listingErr } = await auth.supabase
    .from('service_listings')
    .select('id, seller_id, title, content_locked_at, linked_post_count')
    .eq('id', listingId)
    .maybeSingle()

  if (listingErr || !existingListing) {
    return NextResponse.json({ error: 'Service listing not found' }, { status: 404 })
  }
  if (!existingListing.content_locked_at) {
    return NextResponse.json({ ok: true, idempotent: true, alreadyUnlocked: true })
  }

  const { error: rpcError } = await auth.supabase.rpc('admin_force_unlock_service_listing', {
    p_service_listing_id: listingId,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SERVICE_LISTING_CONTENT_UNLOCK',
    target_id: listingId,
    details: {
      message: 'Service listing content lock removed by admin.',
      listingId,
      sellerId: existingListing.seller_id,
      listingTitle: existingListing.title,
      previousContentLockedAt: existingListing.content_locked_at,
      linkedPostCount: existingListing.linked_post_count,
      reasonCategory,
      reason,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true })
}
