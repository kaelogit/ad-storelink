'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { Package, Loader2, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'
import { Button } from '../../../components/ui'

const PAGE_SIZE = 50

type ListingRow = {
  id: string
  seller_id: string
  title: string
  service_category: string
  hero_price_min: number
  currency_code: string
  is_active: boolean
  seller_display_name: string
  location_country_code: string | null
  created_at: string
}

/** Inner list remounts when country/category key changes so page resets to 0 (no stale offset). */
function ServiceListingsTable({
  countryCode,
  categoryFilter,
}: {
  countryCode: string
  categoryFilter: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const loadList = useCallback(async () => {
    setLoading(true)
    const pCountry = countryCode === ALL_COUNTRIES_CODE ? null : countryCode
    const pCategory = categoryFilter.trim() || null
    const offset = page * PAGE_SIZE
    const { data, error } = await supabase.rpc('get_admin_service_listings', {
      p_country_code: pCountry,
      p_category: pCategory,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })
    if (!error && Array.isArray(data)) {
      setList(data as ListingRow[])
    } else {
      setList([])
    }
    setLoading(false)
  }, [countryCode, categoryFilter, page, supabase])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const hasNext = list.length === PAGE_SIZE
  const hasPrev = page > 0
  const rangeStart = page * PAGE_SIZE + (list.length ? 1 : 0)
  const rangeEnd = page * PAGE_SIZE + list.length

  return (
    <>
      {loading && list.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Package} message="No service listings match the filter." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-bold text-gray-600">Title</th>
                  <th className="text-left p-3 font-bold text-gray-600">Category</th>
                  <th className="text-left p-3 font-bold text-gray-600">From</th>
                  <th className="text-left p-3 font-bold text-gray-600">Seller</th>
                  <th className="text-left p-3 font-bold text-gray-600">Country</th>
                  <th className="text-left p-3 font-bold text-gray-600">Active</th>
                  <th className="text-left p-3 font-bold text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/service-listings/${row.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/dashboard/service-listings/${row.id}`)
                      }
                    }}
                    className="border-b border-gray-100 hover:bg-blue-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium text-gray-900">{row.title}</td>
                    <td className="p-3 text-gray-600">{row.service_category}</td>
                    <td className="p-3 font-mono">
                      {row.currency_code} {(row.hero_price_min / 100).toLocaleString()}+
                    </td>
                    <td className="p-3">{row.seller_display_name}</td>
                    <td className="p-3 text-gray-500">{row.location_country_code ?? '—'}</td>
                    <td className="p-3">
                      {row.is_active ? (
                        <span className="text-green-600 font-bold">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{rangeStart}</span>–
              <span className="font-semibold text-gray-900">{rangeEnd}</span>
              {hasNext ? ' · more on next page' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadList()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw size={14} />}
                Refresh
              </button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrev || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="gap-1"
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <span className="text-sm font-mono text-gray-500 px-2">Page {page + 1}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function ServiceListingsPage() {
  const { countryCode } = useCountryFilter()
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Service Listings"
        subtitle="Browse and filter service listings by country and category. Click a row for full detail."
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
        >
          <option value="">All categories</option>
          <option value="nail_tech">Nail Tech</option>
          <option value="barber">Barber</option>
          <option value="makeup_artist">Makeup Artist</option>
          <option value="makeup_artistry">Makeup Artistry</option>
          <option value="pedicure_manicure">Pedicure/Manicure</option>
          <option value="braids_styling">Braids Styling</option>
          <option value="lashes">Lash Tech</option>
          <option value="skincare">Skincare</option>
          <option value="photographer">Photographer</option>
          <option value="surprise_planners">Surprise Planners</option>
          <option value="event_decorator">Event Decorator</option>
          <option value="tailoring">Tailoring</option>
          <option value="alterations">Alterations</option>
          <option value="custom_outfits">Custom Outfits</option>
        </select>
      </div>

      <ServiceListingsTable key={`${countryCode}-${categoryFilter}`} countryCode={countryCode} categoryFilter={categoryFilter} />
    </div>
  )
}
