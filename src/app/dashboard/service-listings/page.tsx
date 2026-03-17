'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { Package, Loader2, RefreshCcw } from 'lucide-react'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

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

export default function ServiceListingsPage() {
  const supabase = createClient()
  const { countryCode } = useCountryFilter()
  const [list, setList] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const loadList = async () => {
    setLoading(true)
    const pCountry = countryCode === ALL_COUNTRIES_CODE ? null : countryCode
    const pCategory = categoryFilter.trim() || null
    const { data, error } = await supabase.rpc('get_admin_service_listings', {
      p_country_code: pCountry,
      p_category: pCategory,
      p_limit: 100,
      p_offset: 0,
    })
    if (!error && Array.isArray(data)) {
      setList(data as ListingRow[])
    } else {
      setList([])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, categoryFilter])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Service Listings"
        subtitle="List and filter service listings by country and category."
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
          <option value="braids_styling">Braids & Styling</option>
          <option value="lashes">Lash Tech</option>
          <option value="skincare">Skincare</option>
          <option value="tailoring">Tailoring</option>
          <option value="alterations">Alterations</option>
        </select>
        <button
          type="button"
          onClick={loadList}
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCcw size={14} />}
          Refresh
        </button>
      </div>

      {loading && list.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Package} message="No service listings match the filter." />
      ) : (
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
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{row.title}</td>
                  <td className="p-3 text-gray-600">{row.service_category}</td>
                  <td className="p-3 font-mono">{row.currency_code} {(row.hero_price_min / 100).toLocaleString()}+</td>
                  <td className="p-3">{row.seller_display_name}</td>
                  <td className="p-3 text-gray-500">{row.location_country_code ?? '—'}</td>
                  <td className="p-3">{row.is_active ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="p-3 text-gray-500">{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
