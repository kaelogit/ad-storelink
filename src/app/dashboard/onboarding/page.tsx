'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Info, Loader2, RefreshCcw } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

type FunnelStep = {
  stepKey: string
  label: string
  reachedCount: number
  conversionFromPrevious: number | null
  dropOffCount: number
  dropOffRate: number | null
}

type StuckStep = {
  stepKey: string
  count: number
}

type FunnelStats = {
  cohortSignups?: number
  verifiedEmail?: number
  completedOnboarding?: number
  completionRate?: number
  stuckCount?: number
  medianHoursToComplete?: number | null
  cohortDays?: number
  steps?: FunnelStep[]
  stuckByStep?: StuckStep[]
  byRole?: Record<
    string,
    {
      cohortSignups: number
      completedOnboarding: number
      completionRate: number
    }
  >
  methodology?: {
    source?: string
    note?: string
  }
}

const STEP_LABELS: Record<string, string> = {
  email_verify: 'Email verify',
  country: 'Country',
  role: 'Role',
  location: 'Location',
  categories: 'Categories',
  profile_setup: 'Profile setup',
  store_setup: 'Store setup',
  follow_stores: 'Follow stores',
  unknown: 'Unknown',
}

const DAY_OPTIONS = [7, 30, 90, 180] as const

export default function OnboardingFunnelPage() {
  const { countryCode } = useCountryFilter()
  const [stats, setStats] = useState<FunnelStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState<number>(30)
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller'>('all')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
      days: String(days),
      role: roleFilter,
    })

    const response = await fetch(`/api/admin/onboarding/stats?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load onboarding funnel stats.')
      setFeedback({ tone: 'error', message: msg })
      setStats(null)
      setLoading(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { stats?: FunnelStats }
    setStats(payload.stats ?? null)
    setLoading(false)
  }, [countryCode, days, roleFilter])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const maxStepCount = useMemo(() => {
    const steps = stats?.steps ?? []
    return steps.reduce((max, step) => Math.max(max, step.reachedCount), 0)
  }, [stats?.steps])

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const formatPct = (value: number | null | undefined) =>
    value == null ? '—' : `${value.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Funnel"
        subtitle="Step conversion and drop-off for mobile onboarding. Aggregates only — no user identifiers."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/users', label: 'Users' },
              { href: '/dashboard/geo-policy', label: 'Geo policy' },
              { href: '/dashboard/safety-tests', label: 'QA Hub' },
            ]}
          />
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1 text-xs text-blue-900">
            <p className="font-bold">Methodology</p>
            <p>
              Funnel reach is inferred from <code className="rounded bg-white/80 px-1">profiles</code> fields:
              email verification, country, role step, location, category picks (≥3), follows, and{' '}
              <code className="rounded bg-white/80 px-1">onboarding_completed</code>.
            </p>
            <p>{stats?.methodology?.note ?? 'No PII is returned by this desk.'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cohort signups</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats?.cohortSignups?.toLocaleString() ?? '—'}</p>
          <p className="mt-1 text-[10px] text-gray-400">Last {stats?.cohortDays ?? days} days</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email verified</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats?.verifiedEmail?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completed onboarding</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{stats?.completedOnboarding?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completion rate</p>
          <p className="mt-1 text-2xl font-black text-blue-600">{stats?.completionRate ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Stuck users</p>
          <p className="mt-1 text-2xl font-black text-amber-800">{stats?.stuckCount?.toLocaleString() ?? '—'}</p>
          <p className="mt-1 text-[10px] text-amber-600">
            Median to complete: {stats?.medianHoursToComplete != null ? `${stats.medianHoursToComplete}h` : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'buyer', 'seller'] as const).map((role) => (
              <button key={role} className={tabClass(roleFilter === role)} onClick={() => setRoleFilter(role)}>
                {role === 'all' ? 'All roles' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_OPTIONS.map((option) => (
              <button key={option} className={tabClass(days === option)} onClick={() => setDays(option)}>
                {option}d
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadStats()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {stats?.byRole && Object.keys(stats.byRole).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(stats.byRole).map(([roleKey, roleStats]) => (
              <div key={roleKey} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                <span className="font-bold capitalize">{roleKey}</span>
                {' · '}
                {roleStats.completedOnboarding}/{roleStats.cohortSignups} completed ({roleStats.completionRate}%)
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading funnel steps...
            </div>
          ) : (stats?.steps?.length ?? 0) === 0 ? (
            <EmptyState title="No funnel data" message="No signups match the current filters." icon={BarChart3} />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Step</DataTableHead>
                  <DataTableHead>Reached</DataTableHead>
                  <DataTableHead>Conversion</DataTableHead>
                  <DataTableHead>Drop-off</DataTableHead>
                  <DataTableHead>Funnel</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {(stats?.steps ?? []).map((step) => {
                  const widthPct = maxStepCount > 0 ? Math.max(4, (step.reachedCount / maxStepCount) * 100) : 0
                  return (
                    <DataTableRow key={step.stepKey}>
                      <DataTableCell>
                        <span className="text-xs font-bold text-gray-800">{step.label}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-gray-700">{step.reachedCount.toLocaleString()}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-blue-700">{formatPct(step.conversionFromPrevious)}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-amber-700">
                          {step.dropOffCount > 0 ? `${step.dropOffCount.toLocaleString()} (${formatPct(step.dropOffRate)})` : '—'}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="h-2 w-full max-w-[180px] rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Stuck by step</p>
          </div>
          {(stats?.stuckByStep?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">No stuck users in this cohort.</div>
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Step</DataTableHead>
                  <DataTableHead>Users</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {(stats?.stuckByStep ?? []).map((row) => (
                  <DataTableRow key={row.stepKey}>
                    <DataTableCell>
                      <span className="text-xs font-semibold text-gray-800">
                        {STEP_LABELS[row.stepKey] ?? row.stepKey}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs font-bold text-amber-700">{row.count.toLocaleString()}</span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>
      </div>
    </div>
  )
}
