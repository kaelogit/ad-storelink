import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import {
  createServiceSupabaseClient,
  invokeSupabaseEdgeFunction,
} from '../../../../../utils/supabase/service'

type RunPayload = {
  target?: 'products' | 'services' | 'both'
  limit?: number
  batches?: number
}

type BatchResult = {
  target: 'products' | 'services'
  processed: number
  error?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as RunPayload
  const target = body.target ?? 'both'
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 200)
  const batches = Math.min(Math.max(body.batches ?? 1, 1), 20)

  if (!['products', 'services', 'both'].includes(target)) {
    return NextResponse.json({ error: 'target must be products, services, or both' }, { status: 400 })
  }

  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'SEARCH_EMBEDDINGS_RUN')
    .eq('target_id', target)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const results: BatchResult[] = []
  let totalProcessed = 0

  const runTarget = async (kind: 'products' | 'services') => {
    const functionName =
      kind === 'products' ? 'generate-product-embeddings' : 'generate-service-embeddings'
    let processed = 0

    for (let i = 0; i < batches; i += 1) {
      const { data, error } = await invokeSupabaseEdgeFunction<{ processed?: number }>(functionName, {
        limit,
      })

      if (error) {
        results.push({ target: kind, processed, error })
        return
      }

      const batchProcessed = Number(data?.processed ?? 0)
      processed += batchProcessed
      totalProcessed += batchProcessed

      if (batchProcessed === 0) break
    }

    results.push({ target: kind, processed })
  }

  try {
    if (target === 'products' || target === 'both') {
      await runTarget('products')
    }
    if (target === 'services' || target === 'both') {
      await runTarget('services')
    }

    const service = createServiceSupabaseClient()
    const { data: coverage } = await service.rpc('get_search_embedding_coverage')

    await auth.supabase.from('admin_audit_logs').insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action_type: 'SEARCH_EMBEDDINGS_RUN',
      target_id: target,
      details: {
        target,
        limit,
        batches,
        totalProcessed,
        results,
        idempotencyKey,
        coverage,
      },
    })

    return NextResponse.json({
      ok: true,
      target,
      limit,
      batches,
      totalProcessed,
      results,
      coverage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Embedding run failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
