import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const curatorId = (url.searchParams.get('curatorId') || '').trim()
  const hubKind = (url.searchParams.get('kind') || '').trim().toLowerCase()
  const hubRefId = (url.searchParams.get('refId') || '').trim()

  if (!curatorId || !hubKind || !hubRefId) {
    return NextResponse.json({ error: 'curatorId, kind, and refId are required' }, { status: 400 })
  }
  if (!['product', 'service'].includes(hubKind)) {
    return NextResponse.json({ error: 'kind must be product or service' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_admin_curation_hub_detail', {
    p_curator_id: curatorId,
    p_hub_kind: hubKind,
    p_hub_ref_id: hubRefId,
  })

  if (error) {
    const msg = error.message || 'Could not load curation hub'
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ hub: data })
}
