'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, Loader2, RefreshCcw, Search, Zap } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
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
import type { FlashDropRow } from '../../api/admin/flash-drops/list/route'

const ABUSE_LABELS: Record<string, string> = {
  inactive_listing: 'Inactive listing',
  no_real_discount: 'No real discount',
  low_discount: 'Low discount (<5%)',
  high_discount: 'High discount (>70%)',
  long_duration: 'Long flash (>7d)',
  ending_soon: 'Ending soon',
}

function formatEndsIn(minutes: number) {
  if (minutes <= 0) return 'Expired'
  if (minutes < 60) return `${minutes}m left`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h left`
  return `${Math.floor(minutes / 1440)}d left`
}

function listingUrl(row: FlashDropRow) {
  const slug = row.slug || row.listing_id
  if (row.listing_type === 'service') {
    return `https://storelink.ng/service/${encodeURIComponent(slug)}`
  }
  return `https://storelink.ng/p/${encodeURIComponent(slug)}`
}

export default function FlashDropsPage() {
  const { countryCode } = useCountryFilter()
  const [rows, setRows] = useState<FlashDropRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listingType, setListingType] = useState<'all' | 'product' | 'service'>('all')
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const flaggedCount = useMemo(
    () =>
      rows.filter((row) =>
        (row.abuse_flags || []).some((flag) =>
          ['inactive_listing', 'no_real_discount', 'low_discount', 'high_discount', 'long_duration'].includes(flag),
        ),
      ).length,
    [rows],
  )

  const loadRows = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    const params = new URLSearchParams({
      listingType,
      limit: '120',
      offset: '0',
    })
    if (countryCode !== ALL_COUNTRIES_CODE) params.set('countryCode', countryCode)
    if (query.trim()) params.set('q', query.trim())

    const response = await fetch(`/api/admin/flash-drops/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load flash drops.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: FlashDropRow[] }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [countryCode, listingType, query])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flash drops"
        subtitle="Live flash listings across products and services. Review seller, end time, and price delta; flagged rows highlight possible fake urgency."
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabClass(listingType === 'all')} onClick={() => setListingType('all')}>
              All
            </button>
            <button type="button" className={tabClass(listingType === 'product')} onClick={() => setListingType('product')}>
              Products
            </button>
            <button type="button" className={tabClass(listingType === 'service')} onClick={() => setListingType('service')}>
              Services
            </button>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, slug, or seller"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-bold">
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            {rows.length} active flash{rows.length === 1 ? '' : 'es'}
          </span>
          {flaggedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-bold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {flaggedCount} flagged for review
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading flash drops…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Zap} message="No active flash drops match this filter." />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Listing</DataTableHead>
                <DataTableHead>Seller</DataTableHead>
                <DataTableHead>Pricing</DataTableHead>
                <DataTableHead>Ends</DataTableHead>
                <DataTableHead>Flags</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row) => {
                const flags = row.abuse_flags || []
                const reviewFlags = flags.filter((f) => f !== 'ending_soon')
                return (
                  <DataTableRow key={`${row.listing_type}-${row.listing_id}`}>
                    <DataTableCell>
                      <div className="space-y-1 text-xs">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                          {row.listing_type}
                        </span>
                        <p className="font-semibold text-gray-900 line-clamp-2">{row.title}</p>
                        <a
                          href={listingUrl(row)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Open listing
                        </a>
                        {row.listing_type === 'product' ? (
                          <Link
                            href={`/dashboard/products/${row.listing_id}`}
                            className="block text-[10px] text-gray-500 hover:text-blue-600 hover:underline"
                          >
                            Admin product detail
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/service-listings?q=${row.listing_id}`}
                            className="block text-[10px] text-gray-500 hover:text-blue-600 hover:underline"
                          >
                            Service listings desk
                          </Link>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-gray-900">@{row.seller_slug || row.seller_id.slice(0, 8)}</p>
                        <p className="text-gray-500">{row.seller_display_name || '—'}</p>
                        <Link href={`/dashboard/users?q=${row.seller_id}`} className="text-blue-600 hover:underline">
                          Seller dossier
                        </Link>
                        <p className="text-[10px] text-gray-400">{row.location_country || '—'}</p>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="text-xs space-y-0.5 font-mono">
                        <p className="text-gray-500 line-through">
                          {row.currency_code || '—'} {Number(row.regular_price).toLocaleString()}
                        </p>
                        <p className="font-bold text-amber-700">
                          {row.currency_code || '—'} {Number(row.flash_price).toLocaleString()}
                        </p>
                        <p className="text-emerald-700">
                          −{Number(row.price_delta).toLocaleString()} ({Number(row.discount_pct).toFixed(1)}%)
                        </p>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="text-xs space-y-1">
                        <p className="inline-flex items-center gap-1 font-semibold text-gray-900">
                          <Clock className="h-3.5 w-3.5" />
                          {formatEndsIn(row.ends_in_minutes)}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(row.flash_end_time).toLocaleString()}
                        </p>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1">
                        {flags.length === 0 ? (
                          <span className="text-[10px] text-gray-400">—</span>
                        ) : (
                          flags.map((flag) => (
                            <span
                              key={flag}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                reviewFlags.includes(flag)
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {ABUSE_LABELS[flag] || flag}
                            </span>
                          ))
                        )}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        )}
      </div>
    </div>
  )
}
