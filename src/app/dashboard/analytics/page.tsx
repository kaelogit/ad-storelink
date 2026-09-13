'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Info,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Users,
  ShoppingBag,
  CalendarCheck,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

type SeriesRow = {
  report_date: string
  country_code: string
  metrics: {
    dau?: number
    signups?: number
    productGmv?: number
    serviceGmv?: number
    gmvTotal?: number
    productOrders?: number
    serviceOrders?: number
    firstOrderBuyers?: number
    onboarding?: {
      cohortSignups?: number
      completedOnboarding?: number
      completionRate?: number
      stuckCount?: number
    }
  }
  updated_at?: string
}

type WarehousePayload = {
  countryCode?: string
  days?: number
  latest?: SeriesRow['metrics'] | null
  series?: SeriesRow[]
  methodology?: Record<string, string>
}

const DAY_OPTIONS = [7, 30, 90] as const

function money(n: number | undefined | null) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))
}

export default function AnalyticsWarehousePage() {
  const { countryCode } = useCountryFilter()
  const [payload, setPayload] = useState<WarehousePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState<number>(30)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
      days: String(days),
    })
    const response = await fetch(`/api/admin/analytics/warehouse?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load analytics warehouse.')
      setFeedback({ tone: 'error', message: msg })
      setPayload(null)
      setLoading(false)
      return
    }
    const data = (await response.json()) as WarehousePayload
    setPayload(data)
    setLoading(false)
  }, [countryCode, days])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(() => {
    return (payload?.series ?? []).map((row) => ({
      day: row.report_date,
      dau: Number(row.metrics?.dau ?? 0),
      gmv: Number(row.metrics?.gmvTotal ?? 0),
      signups: Number(row.metrics?.signups ?? 0),
      productOrders: Number(row.metrics?.productOrders ?? 0),
    }))
  }, [payload?.series])

  const latest = payload?.latest
  const onboarding = latest?.onboarding

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics warehouse"
        subtitle="Daily DAU, GMV, and conversion snapshots — onboarding funnel from the same pipe as the Onboarding desk."
        actions={
          <div className="flex flex-col items-end gap-2">
            <DeskLinkPills
              links={[
                { href: '/dashboard/onboarding', label: 'Onboarding funnel' },
                { href: '/dashboard', label: 'Overview' },
                { href: '/dashboard/observability', label: 'Observability' },
              ]}
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="flex flex-wrap gap-2">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold border ${
              days === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading && !payload ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : !latest ? (
        <EmptyState
          icon={BarChart3}
          title="No snapshots yet"
          message="Apply the analytics warehouse migration and wait for the 01:15 UTC cron (or run run_analytics_daily_snapshot)."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Users} label="DAU (latest day)" value={String(latest.dau ?? 0)} />
            <MetricCard icon={TrendingUp} label="GMV (latest day)" value={money(latest.gmvTotal)} />
            <MetricCard icon={ShoppingBag} label="Product orders" value={String(latest.productOrders ?? 0)} />
            <MetricCard icon={CalendarCheck} label="Service bookings" value={String(latest.serviceOrders ?? 0)} />
          </div>

          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-violet-900">Onboarding (same pipe as #20)</p>
              <Link href="/dashboard/onboarding" className="text-[11px] font-bold text-violet-700 hover:underline">
                Open live funnel desk →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Cohort signups (30d)" value={String(onboarding?.cohortSignups ?? '—')} />
              <MiniStat label="Completed" value={String(onboarding?.completedOnboarding ?? '—')} />
              <MiniStat label="Completion rate" value={`${onboarding?.completionRate ?? '—'}%`} />
              <MiniStat label="Stuck" value={String(onboarding?.stuckCount ?? '—')} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 h-[320px]">
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-3">DAU & GMV trend</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-500">No series rows for this filter.</p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="dau"
                    name="DAU"
                    stroke="#7c3aed"
                    fill="#ddd6fe"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="gmv"
                    name="GMV"
                    stroke="#059669"
                    fill="#a7f3d0"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {payload?.methodology ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-[10px] text-blue-900 space-y-1 leading-relaxed">
                <p>
                  <span className="font-bold">DAU:</span> {payload.methodology.dau}
                </p>
                <p>
                  <span className="font-bold">GMV:</span> {payload.methodology.gmv}
                </p>
                <p>
                  <span className="font-bold">Onboarding:</span> {payload.methodology.onboarding}
                </p>
                <p>
                  <span className="font-bold">Cron:</span> {payload.methodology.cron}
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-violet-400">{label}</p>
      <p className="text-sm font-black text-violet-950 mt-0.5">{value}</p>
    </div>
  )
}
