import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type ReferralRow = {
  invitee_id: string
  invitee_name: string | null
  invitee_email: string | null
  invitee_country: string | null
  invitee_phone: string | null
  invitee_created_at: string
  inviter_id: string
  inviter_name: string | null
  inviter_email: string | null
  inviter_referral_code: string | null
  attributed_at: string
  signup_coins_paid: number
  order_coins_paid: number
  total_coins_paid: number
  first_order_reward_at: string | null
  fraud_flags: string[] | null
  review_status?: string | null
  signup_reward_granted?: boolean | null
}

type ReferralStats = {
  totalAttributed?: number
  attributedLast30d?: number
  coinsPaidSignup?: number
  coinsPaidOrders?: number
  coinsPaidTotal?: number
  conversionRate?: number
  convertedInvitees?: number
  suspiciousCount?: number
  topInviters?: Array<{
    inviter_id: string
    inviter_name: string | null
    inviter_referral_code: string | null
    invitee_count: number
    coins_paid: number
  }>
  rewardConfig?: Record<string, unknown>
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'finance', 'support', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const country = (url.searchParams.get('country') || '').trim().toUpperCase()
  const inviterId = (url.searchParams.get('inviterId') || '').trim() || null
  const suspiciousOnly = url.searchParams.get('suspicious') === '1'
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 300))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const [{ data: rows, error }, { data: stats, error: statsError }] = await Promise.all([
    auth.supabase.rpc('get_admin_referrals', {
      p_query: q || null,
      p_country_code: country || null,
      p_inviter_id: inviterId,
      p_suspicious_only: suspiciousOnly,
      p_limit: limit,
      p_offset: offset,
    }),
    auth.supabase.rpc('get_admin_referral_stats', {
      p_country_code: country || null,
    }),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 400 })
  }

  return NextResponse.json({
    rows: (Array.isArray(rows) ? rows : []) as ReferralRow[],
    stats: (stats || {}) as ReferralStats,
    pagination: { limit, offset },
  })
}
