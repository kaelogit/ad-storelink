'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { PageHeader } from '../../../../components/admin/PageHeader'
import { Button } from '../../../../components/ui'
import { ArrowLeft, ExternalLink, Loader2, MapPin, User } from 'lucide-react'

const STORE_APP_BASE = process.env.NEXT_PUBLIC_STORELINK_APP_URL || 'https://storelink.ng'

type AdminServiceListingPayload = {
  listing: Record<string, unknown>
  seller: {
    id: string
    display_name: string | null
    email: string | null
    slug: string | null
    location_country_code: string | null
  }
}

export default function AdminServiceListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AdminServiceListingPayload | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('get_admin_service_listing_detail', {
        p_id: id,
      })
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
        setPayload(null)
      } else if (data && typeof data === 'object' && data !== null && 'listing' in data) {
        setPayload(data as AdminServiceListingPayload)
      } else {
        setError('Listing not found.')
        setPayload(null)
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  const listing = payload?.listing
  const seller = payload?.seller

  const publicUrl = id ? `${STORE_APP_BASE.replace(/\/$/, '')}/service/${id}` : ''

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/service-listings')} className="gap-2">
          <ArrowLeft size={18} />
          Back to list
        </Button>
        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink size={16} />
            Open in StoreLink app (live)
          </a>
        ) : null}
      </div>

      <PageHeader
        title={typeof listing?.title === 'string' ? listing.title : 'Service listing'}
        subtitle="Full record as stored in the database (admin view)."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 text-sm font-medium">{error}</div>
      ) : listing && seller ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Listing</h3>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Detail label="ID" value={String(listing.id ?? '')} mono />
                <Detail label="Active" value={listing.is_active ? 'Yes' : 'No'} />
                <Detail label="Category" value={String(listing.service_category ?? '—')} />
                <Detail label="Currency" value={String(listing.currency_code ?? '—')} />
                <Detail
                  label="From price (major)"
                  value={
                    typeof listing.hero_price_min === 'number'
                      ? `${listing.currency_code ?? ''} ${(listing.hero_price_min / 100).toLocaleString()}+`
                      : '—'
                  }
                />
                <Detail label="Location country" value={String(listing.location_country_code ?? '—')} />
                <Detail label="Delivery type" value={String(listing.delivery_type ?? '—')} />
                <Detail label="Created" value={formatDate(listing.created_at)} />
                <Detail label="Updated" value={formatDate(listing.updated_at)} />
              </dl>
              {typeof listing.description === 'string' && listing.description.trim() ? (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase text-gray-500 mb-2">Description</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{listing.description}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Media & menu (JSON)</h3>
              <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-64 text-gray-800">
                {JSON.stringify({ media: listing.media, menu: listing.menu }, null, 2)}
              </pre>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4 flex items-center gap-2">
                <User size={14} /> Seller
              </h3>
              <p className="font-semibold text-gray-900">{seller.display_name ?? '—'}</p>
              <p className="text-sm text-gray-600 mt-1">{seller.email ?? '—'}</p>
              <p className="text-sm text-gray-500 mt-2">@{seller.slug ?? '—'}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} />
                {seller.location_country_code ?? '—'}
              </div>
              <Link href="/dashboard/users" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
                Open Users directory →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  )
}

function formatDate(v: unknown) {
  if (v == null || typeof v !== 'string') return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return String(v)
  }
}
