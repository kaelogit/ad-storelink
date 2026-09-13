import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  campaignId?: string
  action?: string
  reason?: string
  reasonCategory?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const campaignId = body.campaignId?.trim()
  const action = body.action?.trim()?.toLowerCase()
  if (!campaignId || !action) {
    return NextResponse.json({ error: 'campaignId and action are required' }, { status: 400 })
  }
  if (!['approve', 'reject', 'pause', 'resume', 'end'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('moderate_ad_campaign', {
    p_campaign_id: campaignId,
    p_action: action,
    p_reason: body.reason?.trim() || null,
    p_reason_category: body.reasonCategory?.trim() || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
