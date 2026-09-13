import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type UnlockProductPayload = {
  productId?: string
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

  const body = (await request.json()) as UnlockProductPayload
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  const productId = body.productId?.trim()
  const reasonCategory = body.reasonCategory?.trim()
  const reason = body.reason?.trim()

  if (!productId || !reasonCategory || !reason) {
    return NextResponse.json(
      { error: 'productId, reasonCategory and reason are required' },
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
    .eq('action_type', 'PRODUCT_LISTING_CONTENT_UNLOCK')
    .eq('target_id', productId)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()
  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const { data: existingProduct, error: productErr } = await auth.supabase
    .from('products')
    .select('id, seller_id, name, content_locked_at, linked_post_count')
    .eq('id', productId)
    .maybeSingle()

  if (productErr || !existingProduct) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (!existingProduct.content_locked_at) {
    return NextResponse.json({ ok: true, idempotent: true, alreadyUnlocked: true })
  }

  const { error: rpcError } = await auth.supabase.rpc('admin_force_unlock_product_listing', {
    p_product_id: productId,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'PRODUCT_LISTING_CONTENT_UNLOCK',
    target_id: productId,
    details: {
      message: 'Product listing content lock removed by admin.',
      productId,
      sellerId: existingProduct.seller_id,
      productName: existingProduct.name,
      previousContentLockedAt: existingProduct.content_locked_at,
      linkedPostCount: existingProduct.linked_post_count,
      reasonCategory,
      reason,
      idempotencyKey,
    },
  })

  return NextResponse.json({ ok: true })
}
