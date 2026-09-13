import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type Body = {
  campaignId?: string
  amountMinor?: number | null
  reason?: string
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'moderator', 'content', 'finance', 'support'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json()) as Body
  const campaignId = body.campaignId?.trim()
  const reason = body.reason?.trim() || ''
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'reason must be at least 10 characters' }, { status: 400 })
  }

  let amountMinor: number | null = null
  if (body.amountMinor != null && body.amountMinor !== undefined) {
    const n = Number(body.amountMinor)
    if (!Number.isFinite(n) || n < 100) {
      return NextResponse.json(
        { error: 'amountMinor must be at least 100 (1 major currency unit)' },
        { status: 400 },
      )
    }
    amountMinor = Math.floor(n)
  }

  const { data, error } = await auth.supabase.rpc('refund_ad_campaign', {
    p_campaign_id: campaignId,
    p_amount_minor: amountMinor,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? { ok: true })
}
