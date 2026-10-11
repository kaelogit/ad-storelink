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
  UserPlus,
  Percent,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import {
  ChartCard,
  DualAxisLine,
  GroupedBars,
  HorizontalFunnelBars,
  KpiSparkCard,
  StackedArea,
  TrendArea,
  formatCount,
  formatNaira,
  formatPct,
} from '../../../components/admin/charts'
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
    setFeedback(null)
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
      productGmv: Number(row.metrics?.productGmv ?? 0),
      serviceGmv: Number(row.metrics?.serviceGmv ?? 0),
      signups: Number(row.metrics?.signups ?? 0),
      productOrders: Number(row.metrics?.productOrders ?? 0),
      serviceOrders: Number(row.metrics?.serviceOrders ?? 0),
      firstOrderBuyers: Number(row.metrics?.firstOrderBuyers ?? 0),
      cohortSignups: Number(row.metrics?.onboarding?.cohortSignups ?? 0),
      completedOnboarding: Number(row.metrics?.onboarding?.completedOnboarding ?? 0),
      stuckCount: Number(row.metrics?.onboarding?.stuckCount ?? 0),
    }))
  }, [payload?.series])

  const latest = payload?.latest
  const onboarding = latest?.onboarding
  const rangeLabel = `${days}d`
  const hasSeries = chartData.length > 0

  const funnelSteps = useMemo(
    () => [
      {
        name: 'Cohort signups',
        value: Number(onboarding?.cohortSignups ?? 0),
        color: '#0284c7',
      },
      {
        name: 'Completed',
        value: Number(onboarding?.completedOnboarding ?? 0),
        color: '#059669',
      },
      {
        name: 'Stuck',
        value: Number(onboarding?.stuckCount ?? 0),
        color: '#d97706',
      },
    ],
    [onboarding],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Commerce, audience, and conversion intelligence from the daily warehouse."
        actions={
          <div className="flex flex-col items-end gap-2">
            <DeskLinkPills
              links={[
                { href: '/dashboard/onboarding', label: 'Onboarding funnel' },
                { href: '/dashboard', label: 'Overview' },
                { href: '/dashboard/ads/reporting', label: 'Ads reporting' },
                { href: '/dashboard/observability', label: 'Observability' },
              ]}
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-50"
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
              days === d
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading && !payload ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : !latest ? (
        <EmptyState
          icon={BarChart3}
          title="No snapshots yet"
          message="Apply the analytics warehouse migration and wait for the 01:15 UTC cron (or run run_analytics_daily_snapshot)."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiSparkCard
              icon={Users}
              label="DAU"
              value={formatCount(latest.dau)}
              sparkData={chartData}
              sparkKey="dau"
              accent="sky"
            />
            <KpiSparkCard
              icon={TrendingUp}
              label="GMV"
              value={formatNaira(latest.gmvTotal)}
              sparkData={chartData}
              sparkKey="gmv"
              accent="emerald"
            />
            <KpiSparkCard
              icon={ShoppingBag}
              label="Product orders"
              value={formatCount(latest.productOrders)}
              sparkData={chartData}
              sparkKey="productOrders"
              accent="orange"
            />
            <KpiSparkCard
              icon={CalendarCheck}
              label="Service bookings"
              value={formatCount(latest.serviceOrders)}
              sparkData={chartData}
              sparkKey="serviceOrders"
              accent="amber"
            />
            <KpiSparkCard
              icon={UserPlus}
              label="Signups"
              value={formatCount(latest.signups)}
              sparkData={chartData}
              sparkKey="signups"
              accent="slate"
            />
            <KpiSparkCard
              icon={Percent}
              label="Onboarding rate"
              value={formatPct(onboarding?.completionRate)}
              sparkData={chartData}
              sparkKey="completedOnboarding"
              accent="rose"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Commerce mix"
              subtitle="Product vs service GMV"
              rangeLabel={rangeLabel}
              accent="emerald"
              loading={loading}
              empty={!hasSeries}
              height={300}
            >
              <StackedArea
                data={chartData}
                series={[
                  { key: 'productGmv', name: 'Product GMV', color: '#059669' },
                  { key: 'serviceGmv', name: 'Service GMV', color: '#0ea5e9' },
                ]}
                valueKind="money"
              />
            </ChartCard>

            <ChartCard
              title="Demand"
              subtitle="Orders and bookings per day"
              rangeLabel={rangeLabel}
              accent="orange"
              loading={loading}
              empty={!hasSeries}
              height={300}
            >
              <GroupedBars
                data={chartData}
                series={[
                  { key: 'productOrders', name: 'Product orders', color: '#ea580c' },
                  { key: 'serviceOrders', name: 'Service bookings', color: '#d97706' },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Audience"
              subtitle="Daily active users vs new signups"
              rangeLabel={rangeLabel}
              accent="sky"
              loading={loading}
              empty={!hasSeries}
              height={300}
            >
              <DualAxisLine
                data={chartData}
                left={{
                  key: 'dau',
                  name: 'DAU',
                  color: '#0284c7',
                  yAxisId: 'left',
                  valueKind: 'count',
                }}
                right={{
                  key: 'signups',
                  name: 'Signups',
                  color: '#64748b',
                  yAxisId: 'right',
                  valueKind: 'count',
                }}
              />
            </ChartCard>

            <ChartCard
              title="Onboarding conversion"
              subtitle="Latest cohort funnel (same pipe as Onboarding desk)"
              rangeLabel={rangeLabel}
              accent="amber"
              loading={loading}
              empty={funnelSteps.every((s) => s.value === 0)}
              emptyMessage="No onboarding cohort stats in the latest snapshot."
              height={300}
              actions={
                <Link
                  href="/dashboard/onboarding"
                  className="text-[10px] font-bold text-amber-800 hover:underline"
                >
                  Live funnel →
                </Link>
              }
            >
              <HorizontalFunnelBars steps={funnelSteps} />
            </ChartCard>
          </div>

          <ChartCard
            title="First-time buyers"
            subtitle="New buyers placing their first paid order"
            rangeLabel={rangeLabel}
            accent="slate"
            loading={loading}
            empty={!hasSeries}
            height={260}
          >
            <TrendArea
              data={chartData}
              yKey="firstOrderBuyers"
              name="First-time buyers"
              accent="slate"
              valueKind="count"
              gradientId="first-buyers"
            />
          </ChartCard>

          {payload?.methodology ? (
            <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <div className="space-y-1 text-[10px] leading-relaxed text-sky-900">
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
