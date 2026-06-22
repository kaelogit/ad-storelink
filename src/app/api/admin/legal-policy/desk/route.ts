import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const policyType = (url.searchParams.get('policyType') || 'terms').trim().toLowerCase()
  const country = (url.searchParams.get('country') || 'NG').trim().toUpperCase()
  const surface = (url.searchParams.get('surface') || 'app').trim().toLowerCase()

  const { data, error } = await auth.supabase.rpc('get_admin_legal_policy_desk', {
    p_policy_type: policyType,
    p_country_code: country,
    p_surface: surface,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? {})
}
