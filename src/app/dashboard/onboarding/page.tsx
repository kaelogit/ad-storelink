'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Download, Info, Loader2, RefreshCcw } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { HorizontalFunnelBars } from '../../../components/admin/charts'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

type FunnelStep = {
  stepKey: string
  label: string
  reachedCount: number
  signalReached?: number
  pctOfCohort?: number | null
  conversionFromPrevious: number | null
  dropOffCount: number
  dropOffRate: number | null
}

type StuckStep = {
  stepKey: string
  count: number
  pctOfStuck?: number | null
}

type FunnelStats = {
  cohortSignups?: number
  verifiedEmail?: number
  emailVerifiedRate?: number | null
  completedOnboarding?: number
  completionRate?: number
  stuckCount?: number
  medianHoursToComplete?: number | null
  cohortDays?: number
  asOfDay?: string
  roleFilter?: string
  steps?: FunnelStep[]
  stuckByStep?: StuckStep[]
  bottleneck?: FunnelStep | null
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
    version?: number
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

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function OnboardingFunnelPage() {
  const { countryCode } = useCountryFilter()
  const [stats, setStats] = useState<FunnelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number>(30)
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller'>('all')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
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
        return
      }

      const payload = (await response.json().catch(() => ({}))) as { stats?: FunnelStats }
      setStats(payload.stats ?? null)
      setFeedback(null)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to load onboarding funnel stats.',
      })
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [countryCode, days, roleFilter])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const maxStepCount = useMemo(() => {
    const steps = stats?.steps ?? []
    return steps.reduce((max, step) => Math.max(max, step.reachedCount), 0)
  }, [stats?.steps])

  const chartSteps = useMemo(
    () =>
      (stats?.steps ?? []).map((s, i) => ({
        name: s.label,
        value: s.reachedCount,
        color: ['#0284c7', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#059669', '#047857'][i] || '#64748b',
      })),
    [stats?.steps],
  )

  const bottleneck = stats?.bottleneck
  const topStuck = stats?.stuckByStep?.[0]

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const formatPct = (value: number | null | undefined) => (value == null ? '—' : `${value.toFixed(1)}%`)

  const exportCsv = () => {
    if (!stats?.steps?.length) return
    const lines = [
      ['step', 'funnel_reached', 'pct_of_cohort', 'step_to_step', 'drop_off', 'drop_off_rate', 'signal_reached'].join(','),
      ...stats.steps.map((s) =>
        [
          s.label,
          s.reachedCount,
          s.pctOfCohort,
          s.conversionFromPrevious,
          s.dropOffCount,
          s.dropOffRate,
          s.signalReached ?? '',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `onboarding-funnel-${countryCode}-${days}d-${roleFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Funnel"
        subtitle="Live ops desk: furthest-step conversion for mobile onboarding. Aggregates only — no user identifiers."
        actions={
          <div className="flex flex-col items-end gap-2">
            <DeskLinkPills
              links={[
                { href: '/dashboard/analytics', label: 'Analytics warehouse' },
                { href: '/dashboard/users', label: 'Users' },
                { href: '/dashboard/geo-policy', label: 'Geo policy' },
                { href: '/dashboard/safety-tests', label: 'QA Hub' },
              ]}
            />
            <button
              type="button"
              onClick={exportCsv}
              disabled={!stats?.steps?.length}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:underline disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1 text-xs text-blue-900">
            <p className="font-bold">Methodology</p>
            <p>
              {stats?.methodology?.note ??
                'Furthest-step funnel: Signup → Country → Role → Location → Categories → Follow → Completed. Email verify is a parallel health KPI.'}
            </p>
            <p className="text-blue-800/80">
              As of <span className="font-semibold">{stats?.asOfDay ?? 'today'}</span> UTC · last{' '}
              {stats?.cohortDays ?? days} days · role filter <span className="font-semibold">{roleFilter}</span>.
            </p>
          </div>
        </div>
      </div>

      {(bottleneck || topStuck) && (
        <div className="grid gap-3 md:grid-cols-2">
          {bottleneck ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Biggest funnel drop</p>
                  <p className="mt-1 text-sm font-semibold text-amber-950">
                    Into <span className="underline decoration-amber-400">{bottleneck.label}</span>: lost{' '}
                    {bottleneck.dropOffCount.toLocaleString()} ({formatPct(bottleneck.dropOffRate)})
                  </p>
                  <p className="mt-1 text-[11px] text-amber-800/80">
                    Fix the experience for this step first — it removes the most people from the ordered funnel.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {topStuck ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-800">Top stuck bucket</p>
                  <p className="mt-1 text-sm font-semibold text-orange-950">
                    {STEP_LABELS[topStuck.stepKey] ?? topStuck.stepKey}: {topStuck.count.toLocaleString()} users
                    {topStuck.pctOfStuck != null ? ` (${formatPct(topStuck.pctOfStuck)} of stuck)` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-orange-800/80">
                    Incomplete accounts currently blocked here.{' '}
                    <Link href="/dashboard/users" className="font-semibold underline">
                      Open Users
                    </Link>{' '}
                    to investigate.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cohort signups</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats?.cohortSignups?.toLocaleString() ?? '—'}</p>
          <p className="mt-1 text-[10px] text-gray-400">Last {stats?.cohortDays ?? days} days</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email verified</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats?.verifiedEmail?.toLocaleString() ?? '—'}</p>
          <p className="mt-1 text-[10px] text-gray-400">
            Health KPI · {formatPct(stats?.emailVerifiedRate)} of cohort (not a middle funnel gate)
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completed onboarding</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {stats?.completedOnboarding?.toLocaleString() ?? '—'}
          </p>
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
              <button key={role} type="button" className={tabClass(roleFilter === role)} onClick={() => setRoleFilter(role)}>
                {role === 'all' ? 'All roles' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_OPTIONS.map((option) => (
              <button key={option} type="button" className={tabClass(days === option)} onClick={() => setDays(option)}>
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
              <button
                key={roleKey}
                type="button"
                onClick={() => setRoleFilter(roleKey === 'seller' ? 'seller' : 'buyer')}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs hover:border-blue-200 hover:bg-blue-50/50"
              >
                <span className="font-bold capitalize">{roleKey}</span>
                {' · '}
                {roleStats.completedOnboarding}/{roleStats.cohortSignups} completed ({roleStats.completionRate}%)
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && chartSteps.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm font-semibold text-gray-900">Furthest-step funnel</p>
          <p className="mb-3 text-[11px] text-gray-500">Each bar = users who reached at least this far (monotonic).</p>
          <div className="h-[220px]">
            <HorizontalFunnelBars steps={chartSteps} />
          </div>
        </div>
      ) : null}

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
                  <DataTableHead>In funnel</DataTableHead>
                  <DataTableHead>% cohort</DataTableHead>
                  <DataTableHead>Step→step</DataTableHead>
                  <DataTableHead>Drop-off</DataTableHead>
                  <DataTableHead>Signal</DataTableHead>
                  <DataTableHead>Bar</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {(stats?.steps ?? []).map((step) => {
                  const widthPct = maxStepCount > 0 ? Math.max(4, (step.reachedCount / maxStepCount) * 100) : 0
                  const isBottleneck = bottleneck?.stepKey === step.stepKey
                  return (
                    <DataTableRow key={step.stepKey}>
                      <DataTableCell>
                        <span className={`text-xs font-bold ${isBottleneck ? 'text-amber-800' : 'text-gray-800'}`}>
                          {step.label}
                          {isBottleneck ? ' · bottleneck' : ''}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-gray-700">{step.reachedCount.toLocaleString()}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-slate-700">{formatPct(step.pctOfCohort)}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-blue-700">{formatPct(step.conversionFromPrevious)}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className={`text-xs ${step.dropOffCount > 0 ? 'font-semibold text-amber-700' : 'text-gray-400'}`}>
                          {step.dropOffCount > 0
                            ? `${step.dropOffCount.toLocaleString()} (${formatPct(step.dropOffRate)})`
                            : '—'}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="text-xs text-gray-500" title="Raw field coverage (may exceed prior funnel step)">
                          {step.signalReached != null ? step.signalReached.toLocaleString() : '—'}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="h-2 w-full max-w-[180px] rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${isBottleneck ? 'bg-amber-500' : 'bg-blue-500'}`}
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
            <p className="mt-0.5 text-[10px] text-gray-400">Where incomplete accounts are blocked right now</p>
          </div>
          {(stats?.stuckByStep?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">No stuck users in this cohort.</div>
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Step</DataTableHead>
                  <DataTableHead>Users</DataTableHead>
                  <DataTableHead>% stuck</DataTableHead>
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
                    <DataTableCell>
                      <span className="text-xs text-gray-500">{formatPct(row.pctOfStuck)}</span>
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
