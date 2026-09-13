'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, Megaphone, RefreshCcw } from 'lucide-react'

import { PageHeader } from '../../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../../components/admin/EmptyState'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../../../../components/ui/DataTable'
import { parseApiError } from '../../../../utils/http'
import { useCountryFilter } from '../../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../../constants/SupportedCountries'

type Metrics = {
  impressions?: number
  billableImpressions?: number
  spentMinor?: number
  clicks?: number
  ctr?: number | null
  ecpm?: number | null
  revenueMinor?: number
  addToCarts?: number
  purchases?: number
  activeCampaigns?: number
  campaignsServed?: number
  fillIsh?: number | null
}

type SeriesRow = {
  report_date: string
  country_code: string
  placement: string
  metrics: Metrics
}

type WarehousePayload = {
  countryCode?: string
  placement?: string
  days?: number
  latest?: Metrics | null
  series?: SeriesRow[]
  methodology?: Record<string, string>
}

const DAY_OPTIONS = [7, 30, 90] as const
const PLACEMENTS = [
  { value: 'ALL', label: 'All placements' },
  { value: 'explore_reel', label: 'Explore' },
  { value: 'discover_tile', label: 'Discover' },
  { value: 'home_card', label: 'Home' },
] as const

function moneyMinor(minor: number | undefined | null) {
  const main = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(main)
}

export default function AdsReportingPage() {
  const { countryCode } = useCountryFilter()
  const [payload, setPayload] = useState<WarehousePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState<number>(30)
  const [placement, setPlacement] = useState<string>('ALL')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )

  const countryParam = countryCode === ALL_COUNTRIES_CODE ? 'ALL' : countryCode

  const load = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    const params = new URLSearchParams({
      country: countryParam,
      days: String(days),
      placement,
    })
    const res = await fetch(`/api/admin/ads/warehouse?${params.toString()}`)
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Failed to load ads warehouse.') })
      setPayload(null)
      setLoading(false)
      return
    }
    setPayload(await res.json())
    setLoading(false)
  }, [countryParam, days, placement])

  useEffect(() => {
    void load()
  }, [load])

  const series = useMemo(() => (Array.isArray(payload?.series) ? payload!.series! : []), [payload])
  const latest = payload?.latest

  const exportHref = `/api/admin/ads/warehouse/export?country=${encodeURIComponent(
    countryParam,
  )}&days=${days}&placement=${encodeURIComponent(placement)}`

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ads reporting"
        subtitle="Daily Boost warehouse: spend, billable views, clicks, eCPM, conversions. Cron at 01:30 UTC."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/ads"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Campaigns desk
            </Link>
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
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
            className={`rounded-md border px-3 py-1.5 text-sm ${
              days === d ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600'
            }`}
          >
            {d}d
          </button>
        ))}
        <select
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {latest ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Billable views" value={Number(latest.billableImpressions || 0).toLocaleString()} />
          <Kpi label="Spend" value={moneyMinor(latest.spentMinor)} />
          <Kpi label="Clicks" value={Number(latest.clicks || 0).toLocaleString()} />
          <Kpi
            label="eCPM"
            value={latest.ecpm != null ? moneyMinor(Math.round(Number(latest.ecpm))) : '—'}
          />
          <Kpi label="Package revenue" value={moneyMinor(latest.revenueMinor)} />
          <Kpi label="Cart adds" value={Number(latest.addToCarts || 0).toLocaleString()} />
          <Kpi label="Orders" value={Number(latest.purchases || 0).toLocaleString()} />
          <Kpi
            label="Fill-ish"
            value={latest.fillIsh != null ? `${latest.fillIsh}%` : '—'}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : series.length === 0 ? (
        <EmptyState
          title="No warehouse rows"
          message="Apply the AD-25 migration / wait for the 01:30 UTC cron, or run SELECT run_ads_daily_snapshot();"
        />
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Date</DataTableHead>
              <DataTableHead>Billable</DataTableHead>
              <DataTableHead>Spend</DataTableHead>
              <DataTableHead>Clicks</DataTableHead>
              <DataTableHead>CTR</DataTableHead>
              <DataTableHead>eCPM</DataTableHead>
              <DataTableHead>Revenue</DataTableHead>
              <DataTableHead>Cart</DataTableHead>
              <DataTableHead>Orders</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {[...series].reverse().map((row) => {
              const m = row.metrics || {}
              return (
                <DataTableRow key={`${row.report_date}-${row.placement}`}>
                  <DataTableCell>{row.report_date}</DataTableCell>
                  <DataTableCell>{Number(m.billableImpressions || 0).toLocaleString()}</DataTableCell>
                  <DataTableCell>{moneyMinor(m.spentMinor)}</DataTableCell>
                  <DataTableCell>{Number(m.clicks || 0).toLocaleString()}</DataTableCell>
                  <DataTableCell>{m.ctr != null ? `${m.ctr}%` : '—'}</DataTableCell>
                  <DataTableCell>{m.ecpm != null ? moneyMinor(Math.round(Number(m.ecpm))) : '—'}</DataTableCell>
                  <DataTableCell>{moneyMinor(m.revenueMinor)}</DataTableCell>
                  <DataTableCell>{Number(m.addToCarts || 0).toLocaleString()}</DataTableCell>
                  <DataTableCell>{Number(m.purchases || 0).toLocaleString()}</DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      {payload?.methodology ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-zinc-800">
            <Megaphone className="h-3.5 w-3.5" />
            Methodology
          </div>
          <ul className="list-disc space-y-1 pl-4">
            {Object.entries(payload.methodology).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium">{k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  )
}
