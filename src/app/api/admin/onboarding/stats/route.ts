import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

type OnboardingFunnelStats = {
  cohortSignups?: number
  verifiedEmail?: number
  completedOnboarding?: number
  completionRate?: number
  stuckCount?: number
  medianHoursToComplete?: number | null
  cohortDays?: number
  roleFilter?: string
  steps?: Array<{
    stepKey: string
    label: string
    reachedCount: number
    conversionFromPrevious: number | null
    dropOffCount: number
    dropOffRate: number | null
  }>
  stuckByStep?: Array<{ stepKey: string; count: number }>
  byRole?: Record<
    string,
    {
      cohortSignups: number
      completedOnboarding: number
      completionRate: number
    }
  >
  methodology?: Record<string, unknown>
}

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const country = (url.searchParams.get('country') || '').trim().toUpperCase()
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365))
  const role = (url.searchParams.get('role') || 'all').trim().toLowerCase()

  const { data, error } = await auth.supabase.rpc('get_admin_onboarding_funnel_stats', {
    p_country_code: country || null,
    p_days: Number.isFinite(days) ? days : 30,
    p_role: role || 'all',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ stats: (data || {}) as OnboardingFunnelStats })
}
