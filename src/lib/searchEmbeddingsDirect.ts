/**
 * Direct Gemini → product/service_embeddings backfill for the admin Search AI desk.
 * Used when Edge Function auth fails (Unauthorized) or GEMINI_API_KEY is preferred.
 */

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
const GEMINI_EMBEDDING_DIMENSION = 768

function l2Normalize(values: number[]): number[] {
  let sumSq = 0
  for (const v of values) sumSq += v * v
  const norm = Math.sqrt(sumSq)
  if (!Number.isFinite(norm) || norm === 0) return values
  return values.map((v) => v / norm)
}

async function embedText(apiKey: string, text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Cannot embed empty text')

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=` +
    apiKey

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text: trimmed }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: GEMINI_EMBEDDING_DIMENSION,
    }),
  })

  const data = (await resp.json()) as {
    embedding?: { values?: number[] }
    embeddings?: { values?: number[] }[]
    error?: { message?: string }
  }

  if (!resp.ok) {
    throw new Error(data.error?.message || 'Gemini embed failed')
  }

  const values = data.embedding?.values ?? data.embeddings?.[0]?.values
  if (!values?.length) throw new Error('Embedding returned empty')
  return l2Normalize(values)
}

type ProductRow = { id: string; name: string | null; description: string | null }
type ServiceRow = {
  id: string
  title: string | null
  description: string | null
  service_category: string | null
}

export type DirectEmbedResult = {
  processed: number
  failed: number
  error?: string
  failures?: { id: string; error: string }[]
}

type ServiceClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>
  }
}

export async function embedMissingProductsDirect(
  service: ServiceClient,
  limit: number,
): Promise<DirectEmbedResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { processed: 0, failed: 0, error: 'GEMINI_API_KEY not set on admin server' }
  }

  const { data, error } = await service.rpc('list_products_missing_embeddings', {
    p_limit: limit,
  })
  if (error) return { processed: 0, failed: 0, error: error.message }

  const items = (Array.isArray(data) ? data : []) as ProductRow[]
  let processed = 0
  let failed = 0
  const failures: { id: string; error: string }[] = []

  for (const product of items) {
    const text = `${(product.name || '').trim()}. ${(product.description || '').trim()}`.slice(0, 800)
    if (!text.trim()) continue
    try {
      const embedding = await embedText(apiKey, text)
      const { error: upsertError } = await service.from('product_embeddings').upsert(
        {
          product_id: product.id,
          embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id' },
      )
      if (upsertError) throw new Error(upsertError.message)
      processed += 1
    } catch (err) {
      failed += 1
      failures.push({
        id: product.id,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      })
    }
  }

  return { processed, failed, failures: failures.slice(0, 10) }
}

export async function embedMissingServicesDirect(
  service: ServiceClient,
  limit: number,
): Promise<DirectEmbedResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { processed: 0, failed: 0, error: 'GEMINI_API_KEY not set on admin server' }
  }

  const { data, error } = await service.rpc('list_service_listings_missing_embeddings', {
    p_limit: limit,
  })
  if (error) return { processed: 0, failed: 0, error: error.message }

  const items = (Array.isArray(data) ? data : []) as ServiceRow[]
  let processed = 0
  let failed = 0
  const failures: { id: string; error: string }[] = []

  for (const listing of items) {
    const text =
      `${(listing.title || '').trim()}. ${(listing.service_category || '').trim()}. ${(listing.description || '').trim()}`.slice(
        0,
        800,
      )
    if (!text.trim()) continue
    try {
      const embedding = await embedText(apiKey, text)
      const { error: upsertError } = await service.from('service_embeddings').upsert(
        {
          service_listing_id: listing.id,
          embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'service_listing_id' },
      )
      if (upsertError) throw new Error(upsertError.message)
      processed += 1
    } catch (err) {
      failed += 1
      failures.push({
        id: listing.id,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      })
    }
  }

  return { processed, failed, failures: failures.slice(0, 10) }
}
