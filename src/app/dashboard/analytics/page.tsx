'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Download,
  Info,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Users,
  ShoppingBag,
  CalendarCheck,
  UserPlus,
  Percent,
  RotateCcw,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
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
  formatMoney,
  formatPct,
} from '../../../components/admin/charts'
import { parseApiError } from '../../../utils/http'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE, currencyForCountryCode } from '../../../constants/SupportedCountries'

type SeriesRow = {
  report_date: string
  country_code: string
  metrics: {
    dau?: number
    signups?: number
    productGmv?: number | null
    productGmvCompleted?: number | null
    serviceGmv?: number | null
    gmvTotal?: number | null
    gmvCompleted?: number | null
    productOrders?: number
    serviceOrders?: number
    firstOrderBuyers?: number
    currencyCode?: string | null
    moneyMixed?: boolean
    conversion?: { signupToFirstOrderRate?: number | null }
    checkoutFunnel?: {
      awaitingPayment?: number
      paidPlus?: number
      completed?: number
      cancelled?: number
      disputed?: number
    }
    retention?: {
      repeatBuyers?: number
      d7CohortSignups?: number
      d7Returned?: number
      d7RetentionRate?: number | null
    }
    topSellers?: Array<{ sellerId?: string; sellerName?: string; orders?: number; gmv?: number }>
    topCategories?: Array<{ category?: string; orders?: number; gmv?: number }>
    onboarding?: {
      cohortSignups?: number
      completedOnboarding?: number
      completionRate?: number
      stuckCount?: number
      asOfDay?: string
      steps?: Array<{ label?: string; reachedCount?: number }>
    }
  }
  updated_at?: string
}

type WarehousePayload = {
  countryCode?: string
  days?: number
  latest?: SeriesRow['metrics'] | null
  latestReportDate?: string | null
  series?: SeriesRow[]
  methodology?: Record<string, string>
}

const DAY_OPTIONS = [7, 30, 90] as const

export default function AnalyticsWarehousePage() {
  const { countryCode, isGlobalView } = useCountryFilter()
  const [payload, setPayload] = useState<WarehousePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number>(30)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )
  const deskCurrency = currencyForCountryCode(isGlobalView ? 'NG' : countryCode)
  const moneyLabel = (amount: number | null | undefined) =>
    isGlobalView || amount == null ? '—' : formatMoney(amount, deskCurrency)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
        days: String(days),
      })
      const response = await fetch(`/api/admin/analytics/warehouse?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Failed to load analytics warehouse.')
        setFeedback({ tone: 'error', message: msg })
        setPayload(null)
        return
      }
      const data = (await response.json()) as WarehousePayload
      setPayload(data)
      setFeedback(null)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to load analytics warehouse.',
      })
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [countryCode, days])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(() => {
    return (payload?.series ?? []).map((row) => ({
      day: row.report_date,
      dau: Number(row.metrics?.dau ?? 0),
      gmv: Number(row.metrics?.gmvTotal ?? 0),
      gmvCompleted: Number(row.metrics?.gmvCompleted ?? 0),
      productGmv: Number(row.metrics?.productGmv ?? 0),
      serviceGmv: Number(row.metrics?.serviceGmv ?? 0),
      signups: Number(row.metrics?.signups ?? 0),
      productOrders: Number(row.metrics?.productOrders ?? 0),
      serviceOrders: Number(row.metrics?.serviceOrders ?? 0),
      firstOrderBuyers: Number(row.metrics?.firstOrderBuyers ?? 0),
      repeatBuyers: Number(row.metrics?.retention?.repeatBuyers ?? 0),
      d7RetentionRate: Number(row.metrics?.retention?.d7RetentionRate ?? 0),
      awaitingPayment: Number(row.metrics?.checkoutFunnel?.awaitingPayment ?? 0),
      paidPlus: Number(row.metrics?.checkoutFunnel?.paidPlus ?? 0),
      completedOrders: Number(row.metrics?.checkoutFunnel?.completed ?? 0),
      cohortSignups: Number(row.metrics?.onboarding?.cohortSignups ?? 0),
      completedOnboarding: Number(row.metrics?.onboarding?.completedOnboarding ?? 0),
      completionRate: Number(row.metrics?.onboarding?.completionRate ?? 0),
      stuckCount: Number(row.metrics?.onboarding?.stuckCount ?? 0),
      signupToFirstOrderRate: Number(row.metrics?.conversion?.signupToFirstOrderRate ?? 0),
    }))
  }, [payload?.series])

  const latest = payload?.latest
  const onboarding = latest?.onboarding
  const rangeLabel = `${days}d`
  const hasSeries = chartData.length > 0
  const latestDayLabel = payload?.latestReportDate || (chartData.length > 0 ? chartData[chartData.length - 1]?.day : null)

  const rangeKpis = useMemo(() => {
    const n = chartData.length
    const sum = (key: keyof (typeof chartData)[number]) =>
      chartData.reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
    const avgDau = n > 0 ? sum('dau') / n : 0
    const d7Rates = chartData.map((r) => r.d7RetentionRate).filter((v) => v > 0)
    const avgD7 = d7Rates.length > 0 ? d7Rates.reduce((a, b) => a + b, 0) / d7Rates.length : null
    const v2Days = (payload?.series ?? []).filter((r) => Number((r.metrics as { pipe?: { version?: number } })?.pipe?.version) === 2).length
    return {
      avgDau,
      gmv: sum('gmv'),
      gmvCompleted: sum('gmvCompleted'),
      productOrders: sum('productOrders'),
      serviceOrders: sum('serviceOrders'),
      signups: sum('signups'),
      firstOrderBuyers: sum('firstOrderBuyers'),
      repeatBuyers: sum('repeatBuyers'),
      avgD7,
      daysWithData: n,
      v2Days,
    }
  }, [chartData, payload?.series])

  const funnelSteps = useMemo(() => {
    const steps = onboarding?.steps
    if (Array.isArray(steps) && steps.length > 0) {
      return steps.slice(0, 8).map((s, i) => ({
        name: s.label || `Step ${i + 1}`,
        value: Number(s.reachedCount ?? 0),
        color: ['#0284c7', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#059669', '#047857', '#065f46'][i] || '#64748b',
      }))
    }
    return [
      { name: 'Cohort signups', value: Number(onboarding?.cohortSignups ?? 0), color: '#0284c7' },
      { name: 'Completed', value: Number(onboarding?.completedOnboarding ?? 0), color: '#059669' },
    ]
  }, [onboarding])

  const checkoutSteps = useMemo(() => {
    const f = latest?.checkoutFunnel
    return [
      { name: 'Awaiting pay', value: Number(f?.awaitingPayment ?? 0), color: '#94a3b8' },
      { name: 'Paid+', value: Number(f?.paidPlus ?? 0), color: '#ea580c' },
      { name: 'Completed', value: Number(f?.completed ?? 0), color: '#059669' },
    ]
  }, [latest?.checkoutFunnel])

  const topSellers = latest?.topSellers ?? []
  const topCategories = latest?.topCategories ?? []

  const runBackfill = async (payload: { category: string; reason: string }) => {
    setBackfilling(true)
    setBackfillOpen(false)
    let offset = 0
    let totalRows = 0
    const chunk = 10
    try {
      while (true) {
        setFeedback({
          tone: 'info',
          message: `Backfilling v2 metrics… ${Math.min(offset, days)}/${days} days`,
        })
        const response = await fetch('/api/admin/analytics/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            days,
            offset,
            limit: chunk,
            reason: `[${payload.category}] ${payload.reason}`.slice(0, 500),
          }),
        })
        if (!response.ok) {
          setFeedback({ tone: 'error', message: await parseApiError(response, 'Backfill failed.') })
          return
        }
        const data = (await response.json()) as {
          done?: boolean
          nextOffset?: number
          rowsWritten?: number
        }
        totalRows += Number(data.rowsWritten ?? 0)
        offset = Number(data.nextOffset ?? offset + chunk)
        if (data.done || offset >= days) break
      }
      setFeedback({
        tone: 'success',
        message: `Backfill done for ${days}d (${totalRows} country-rows written).`,
      })
      await load()
    } finally {
      setBackfilling(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams({
      country: countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode,
      days: String(days),
    })
    window.location.href = `/api/admin/analytics/warehouse/export?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Marketplace warehouse v2 — window KPIs, dual GMV, checkout funnel, tops, retention, day-true onboarding, CSV export."
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
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:underline"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setBackfillOpen(true)}
                disabled={backfilling || loading}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 hover:underline disabled:opacity-50"
              >
                {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Backfill {days}d
              </button>
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
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <ActionReasonModal
        open={backfillOpen}
        title={`Backfill analytics (${days}d)?`}
        description="Recomputes daily warehouse rows with v2 metrics (dual GMV, funnels, tops, retention). Runs in chunks so it won’t time out."
        impactSummary="Existing snapshot rows for the window are overwritten. Cron at 01:15 UTC continues afterward."
        categoryOptions={[
          { value: 'analytics_upgrade', label: 'Analytics upgrade / fill history' },
          { value: 'data_repair', label: 'Data repair' },
          { value: 'pre_deploy', label: 'Pre-deploy check' },
        ]}
        submitting={backfilling}
        onClose={() => setBackfillOpen(false)}
        onSubmit={runBackfill}
      />

      {isGlobalView && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-semibold">All countries — money KPIs/charts hidden (FX-safe)</p>
          <p className="mt-1 text-xs text-amber-700">
            DAU, orders, and signups aggregate. GMV/tops stay blank until you pick a country.
          </p>
        </div>
      )}

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
          message="Apply analytics warehouse v2 migration, then Backfill 90d (or wait for 01:15 UTC cron)."
        />
      ) : (
        <>
          {latestDayLabel ? (
            <p className="text-[11px] text-gray-500">
              Window <span className="font-semibold text-gray-700">{rangeLabel}</span>
              {rangeKpis.daysWithData > 0 ? ` · ${rangeKpis.daysWithData} days` : ''} · latest snapshot{' '}
              <span className="font-semibold text-gray-700">{latestDayLabel}</span>
              {latest.currencyCode ? ` · ${latest.currencyCode}` : ''}
              {rangeKpis.daysWithData > 0 && rangeKpis.v2Days < rangeKpis.daysWithData ? (
                <>
                  {' '}
                  · <span className="font-semibold text-amber-700">v2 coverage {rangeKpis.v2Days}/{rangeKpis.daysWithData} — run Backfill</span>
                </>
              ) : null}
              .
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiSparkCard
              icon={Users}
              label={`Avg DAU (${rangeLabel})`}
              value={formatCount(Math.round(rangeKpis.avgDau))}
              sparkData={chartData}
              sparkKey="dau"
              accent="sky"
            />
            <KpiSparkCard
              icon={TrendingUp}
              label={`GMV paid+ (${rangeLabel})`}
              value={moneyLabel(isGlobalView ? null : rangeKpis.gmv)}
              sparkData={isGlobalView ? [] : chartData}
              sparkKey="gmv"
              accent="emerald"
            />
            <KpiSparkCard
              icon={ShoppingBag}
              label={`Product orders (${rangeLabel})`}
              value={formatCount(rangeKpis.productOrders)}
              sparkData={chartData}
              sparkKey="productOrders"
              accent="orange"
            />
            <KpiSparkCard
              icon={CalendarCheck}
              label={`Service bookings (${rangeLabel})`}
              value={formatCount(rangeKpis.serviceOrders)}
              sparkData={chartData}
              sparkKey="serviceOrders"
              accent="amber"
            />
            <KpiSparkCard
              icon={UserPlus}
              label={`Signups (${rangeLabel})`}
              value={formatCount(rangeKpis.signups)}
              sparkData={chartData}
              sparkKey="signups"
              accent="slate"
            />
            <KpiSparkCard
              icon={Percent}
              label="Onboarding rate"
              value={formatPct(onboarding?.completionRate)}
              sparkData={chartData}
              sparkKey="completionRate"
              accent="rose"
            />
          </div>

          <p className="text-[10px] text-gray-400">
            Overview-aligned product completed GMV ({rangeLabel}):{' '}
            {moneyLabel(
              isGlobalView
                ? null
                : (payload?.series ?? []).reduce(
                    (acc, row) => acc + Number(row.metrics?.productGmvCompleted ?? 0),
                    0,
                  ),
            )}{' '}
            ·
            First-time buyers (product+service): {formatCount(rangeKpis.firstOrderBuyers)} · Repeat buyers:{' '}
            {formatCount(rangeKpis.repeatBuyers)} · Avg D7 retention:{' '}
            {rangeKpis.avgD7 == null ? '—' : formatPct(rangeKpis.avgD7)} · Same-day signup→first purchase (latest):{' '}
            {formatPct(latest.conversion?.signupToFirstOrderRate ?? undefined)}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {!isGlobalView ? (
              <ChartCard
                title="Commerce mix"
                subtitle="Product vs service GMV (paid+)"
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
                  currency={deskCurrency}
                />
              </ChartCard>
            ) : null}

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
              title="Checkout funnel"
              subtitle="Product orders created on latest snapshot day"
              rangeLabel={latestDayLabel || 'latest'}
              accent="orange"
              loading={loading}
              empty={checkoutSteps.every((s) => s.value === 0)}
              height={300}
            >
              <HorizontalFunnelBars steps={checkoutSteps} />
            </ChartCard>

            <ChartCard
              title="Onboarding conversion"
              subtitle={`Day-true trailing 30d as of ${onboarding?.asOfDay || latestDayLabel || '—'}`}
              rangeLabel="~30d"
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

            <ChartCard
              title="D7 retention"
              subtitle="% of signups from day−7 who returned on report day"
              rangeLabel={rangeLabel}
              accent="rose"
              loading={loading}
              empty={!hasSeries}
              height={300}
            >
              <TrendArea
                data={chartData}
                yKey="d7RetentionRate"
                name="D7 retention %"
                accent="rose"
                valueKind="count"
                gradientId="d7-ret"
              />
            </ChartCard>
          </div>

          <ChartCard
            title="First-time buyers"
            subtitle="First qualifying product or service purchase that day"
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

          {!isGlobalView ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">Top sellers (latest day)</p>
                <p className="mb-3 text-[11px] text-gray-500">Paid+ product GMV on {latestDayLabel}</p>
                {topSellers.length === 0 ? (
                  <p className="text-xs text-gray-400">No seller GMV that day.</p>
                ) : (
                  <ul className="space-y-2">
                    {topSellers.map((s, i) => (
                      <li key={s.sellerId || i} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-800">{s.sellerName || s.sellerId}</span>
                        <span className="text-gray-500">
                          {formatCount(s.orders)} · {moneyLabel(s.gmv)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">Top categories (latest day)</p>
                <p className="mb-3 text-[11px] text-gray-500">Paid+ product GMV on {latestDayLabel}</p>
                {topCategories.length === 0 ? (
                  <p className="text-xs text-gray-400">No category GMV that day.</p>
                ) : (
                  <ul className="space-y-2">
                    {topCategories.map((c, i) => (
                      <li key={c.category || i} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-800">{c.category}</span>
                        <span className="text-gray-500">
                          {formatCount(c.orders)} · {moneyLabel(c.gmv)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

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
                  <span className="font-bold">First buyers:</span> {payload.methodology.firstBuyers}
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
