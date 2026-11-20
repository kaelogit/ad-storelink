import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import { createServiceSupabaseClient } from '../../../../../utils/supabase/service'

type MissingProduct = { id: string; name: string | null; description: string | null }
type MissingService = {
  id: string
  title: string | null
  description: string | null
  service_category: string | null
}

export async function GET() {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const service = createServiceSupabaseClient()
    const [{ data, error }, productsMissing, servicesMissing] = await Promise.all([
      service.rpc('get_search_embedding_coverage'),
      service.rpc('list_products_missing_embeddings', { p_limit: 20 }),
      service.rpc('list_service_listings_missing_embeddings', { p_limit: 20 }),
    ])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({
      coverage: data,
      /** Active listings only — deleted/inactive never appear here. */
      missingSample: {
        products: (Array.isArray(productsMissing.data) ? productsMissing.data : []) as MissingProduct[],
        services: (Array.isArray(servicesMissing.data) ? servicesMissing.data : []) as MissingService[],
        productsError: productsMissing.error?.message ?? null,
        servicesError: servicesMissing.error?.message ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load embedding coverage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
