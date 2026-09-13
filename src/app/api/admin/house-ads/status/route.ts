import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type StatusBody = {
  campaignId?: string
  status?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as StatusBody
  const campaignId = body.campaignId?.trim()
  const status = body.status?.trim()
  if (!campaignId || !status) {
    return NextResponse.json({ error: 'campaignId and status are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('admin_set_house_ad_campaign_status', {
    p_campaign_id: campaignId,
    p_status: status,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
