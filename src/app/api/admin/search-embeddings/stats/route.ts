import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import { createServiceSupabaseClient } from '../../../../../utils/supabase/service'

export async function GET() {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const service = createServiceSupabaseClient()
    const { data, error } = await service.rpc('get_search_embedding_coverage')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ coverage: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load embedding coverage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
