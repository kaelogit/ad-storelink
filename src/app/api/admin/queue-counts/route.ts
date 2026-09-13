import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../utils/auth/apiAdmin'

/**
 * Lightweight queue counts for sidebar badges.
 */
export async function GET() {
  const auth = await getApiAdminContext([
    'super_admin',
    'moderator',
    'finance',
    'support',
    'content',
    'analyst',
  ])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let kyc = 0
  let disputes = 0
  let ads = 0
  let reports = 0
  const warnings: string[] = []

  const [statsRes, adsRes, reportsRes] = await Promise.all([
    auth.supabase.rpc('get_admin_dashboard_stats', { p_country_code: null }),
    auth.supabase.rpc('admin_list_ad_campaigns', {
      p_status: 'pending_review',
      p_country_code: null,
      p_advertiser_type: null,
      p_search: null,
      p_limit: 1,
      p_offset: 0,
    }),
    auth.supabase.rpc('get_admin_content_reports_inbox', {
      p_report_type: 'all',
      p_status: 'open',
      p_q: null,
      p_limit: 1,
      p_offset: 0,
    }),
  ])

  if (statsRes.error) {
    warnings.push(`stats: ${statsRes.error.message}`)
  } else if (statsRes.data) {
    const stats = statsRes.data as { pending_kyc?: number; active_disputes?: number }
    kyc = Number(stats.pending_kyc || 0)
    disputes = Number(stats.active_disputes || 0)
  }

  if (adsRes.error) {
    warnings.push(`ads: ${adsRes.error.message}`)
  } else if (adsRes.data) {
    const payload = adsRes.data as { pendingReview?: number }
    ads = Number(payload.pendingReview || 0)
  }

  if (reportsRes.error) {
    warnings.push(`reports: ${reportsRes.error.message}`)
  } else if (reportsRes.data) {
    const payload = reportsRes.data as {
      summary?: { openTotal?: number }
    }
    reports = Number(payload.summary?.openTotal || 0)
  }

  return NextResponse.json({ kyc, disputes, ads, reports, warnings })
}
