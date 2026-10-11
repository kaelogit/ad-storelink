'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { PageHeader } from '../../../../components/admin/PageHeader'
import { Button } from '../../../../components/ui'
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Phone,
  User,
} from 'lucide-react'
import { ActionReasonModal } from '../../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../../components/admin/ActionFeedback'
import { parseApiError } from '../../../../utils/http'
import { AdminAvatar } from '../../../../components/admin/AdminAvatar'

const STORE_APP_BASE = process.env.NEXT_PUBLIC_STORELINK_APP_URL || 'https://storelink.ng'

type SellerPayload = {
  id: string
  display_name: string | null
  email: string | null
  phone?: string | null
  slug: string | null
  location_country_code: string | null
  location_city?: string | null
  location_state?: string | null
  service_location_type?: string | null
  service_areas?: unknown
  logo_url?: string | null
}

type AdminServiceListingPayload = {
  listing: Record<string, unknown>
  seller: SellerPayload
}

function fromMinor(amountMinor: unknown, currencyCode: unknown): string {
  const code = String(currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  const n = Number(amountMinor || 0) / Math.pow(10, decimals)
  return `${code} ${n.toLocaleString()}`
}

function asStringArray(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}

function asMenu(raw: unknown): Array<{ name: string; price_minor: number }> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name : 'Item'
      const price = Number(o.price_minor ?? 0)
      return { name, price_minor: price }
    })
    .filter(Boolean) as Array<{ name: string; price_minor: number }>
}

function asMedia(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((u) => String(u || '')).filter((u) => /^https?:\/\//i.test(u))
}

export default function AdminServiceListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<AdminServiceListingPayload | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [moderateIntent, setModerateIntent] = useState<'activate' | 'deactivate' | null>(null)
  const [unlockIntent, setUnlockIntent] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

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
  }, [id, supabase])

  const listing = payload?.listing
  const seller = payload?.seller
  const isActive = Boolean(listing?.is_active)
  const contentLockedAt = typeof listing?.content_locked_at === 'string' ? listing.content_locked_at : null
  const linkedPostCount =
    typeof listing?.linked_post_count === 'number' ? listing.linked_post_count : 0

  const publicUrl = id ? `${STORE_APP_BASE.replace(/\/$/, '')}/service/${id}` : ''
  const media = useMemo(() => asMedia(listing?.media), [listing?.media])
  const menu = useMemo(() => asMenu(listing?.menu), [listing?.menu])
  const listingAreas = useMemo(() => asStringArray(listing?.service_areas), [listing?.service_areas])
  const sellerAreas = useMemo(() => asStringArray(seller?.service_areas), [seller?.service_areas])

  const locationLine = useMemo(() => {
    if (!listing && !seller) return '—'
    const city = seller?.location_city?.trim() || null
    const state = seller?.location_state?.trim() || null
    const country =
      seller?.location_country_code?.trim() ||
      (typeof listing?.location_country_code === 'string' ? listing.location_country_code.trim() : null) ||
      null
    const parts = [city, state, country].filter(Boolean)
    return parts.length ? parts.join(', ') : '—'
  }, [listing, seller])

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ tone: 'success', message: `${label} copied.` })
    } catch {
      setFeedback({ tone: 'error', message: `Could not copy ${label}.` })
    }
  }

  const runModeration = async ({ category, reason }: { category: string; reason: string }) => {
    if (!listing?.id || !moderateIntent) return
    const nextActive = moderateIntent === 'activate'
    setActionLoading(true)
    setFeedback({ tone: 'info', message: `${nextActive ? 'Activating' : 'Deactivating'} listing...` })
    const response = await fetch('/api/admin/service-listings/moderate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `service-listing-moderate-${listing.id}-${nextActive ? 'active' : 'inactive'}`,
      },
      body: JSON.stringify({
        listingId: listing.id,
        isActive: nextActive,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to moderate service listing.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            listing: {
              ...prev.listing,
              is_active: nextActive,
            },
          }
        : prev
    )
    setFeedback({ tone: 'success', message: `Service listing ${nextActive ? 'activated' : 'deactivated'} successfully.` })
    setModerateIntent(null)
    setActionLoading(false)
  }

  const runContentUnlock = async ({ category, reason }: { category: string; reason: string }) => {
    if (!listing?.id) return
    setActionLoading(true)
    setFeedback({ tone: 'info', message: 'Removing content lock...' })
    const response = await fetch('/api/admin/service-listings/unlock-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `service-unlock-${listing.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        listingId: listing.id,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to unlock service listing.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            listing: {
              ...prev.listing,
              content_locked_at: null,
            },
          }
        : prev
    )
    setFeedback({ tone: 'success', message: 'Content lock removed. Seller can edit identity fields again.' })
    setUnlockIntent(false)
    setActionLoading(false)
  }

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
        subtitle="Ops view: location, menu, media, policies, and seller context."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 text-sm font-medium">{error}</div>
      ) : listing && seller ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 p-5 lg:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip active={isActive} />
                  <span className="inline-flex rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-700 ring-1 ring-gray-200">
                    {String(listing.service_category || 'uncategorized')}
                  </span>
                  {contentLockedAt ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                      Content locked
                    </span>
                  ) : null}
                  {Boolean(listing.is_flash_drop) ? (
                    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">
                      Flash drop
                    </span>
                  ) : null}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Listing ID</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm text-gray-900 break-all">{String(listing.id)}</p>
                    <button
                      type="button"
                      onClick={() => void copyText(String(listing.id), 'Listing ID')}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Meta label="From price" value={fromMinor(listing.hero_price_min, listing.currency_code) + '+'} />
                  <Meta label="Currency" value={String(listing.currency_code || '—')} />
                  <Meta label="Delivery type" value={String(listing.delivery_type || listing.location_type || '—')} />
                  <Meta label="Tagged posts" value={String(linkedPostCount)} />
                  <Meta label="Published" value={formatDate(listing.published_at)} />
                  <Meta label="Updated" value={formatDate(listing.updated_at)} />
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/80 flex items-center gap-1">
                    <MapPin size={12} /> Location
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{locationLine}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Listing country: {String(listing.location_country_code || '—')}
                    {listing.location_type ? ` · location_type: ${String(listing.location_type)}` : ''}
                    {seller.service_location_type ? ` · seller type: ${seller.service_location_type}` : ''}
                  </p>
                  {(listingAreas.length > 0 || sellerAreas.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(listingAreas.length ? listingAreas : sellerAreas).map((area) => (
                        <span
                          key={area}
                          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 ring-1 ring-emerald-100"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                  {listingAreas.length === 0 && sellerAreas.length > 0 ? (
                    <p className="mt-2 text-[10px] text-emerald-900/70">
                      Listing has no service_areas; showing seller profile areas.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/80 p-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Moderation</p>
                <button
                  type="button"
                  onClick={() => setModerateIntent(isActive ? 'deactivate' : 'activate')}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-bold ${
                    isActive
                      ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {isActive ? 'Deactivate listing' : 'Activate listing'}
                </button>
                {contentLockedAt ? (
                  <button
                    type="button"
                    onClick={() => setUnlockIntent(true)}
                    className="w-full rounded-lg px-3 py-2 text-xs font-bold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    Force unlock content
                  </button>
                ) : (
                  <p className="text-[11px] text-gray-500">Content lock: none</p>
                )}
                <p className="text-[11px] text-gray-500 pt-2">
                  Created {formatDate(listing.created_at)}
                  <br />
                  First linked {formatDate(listing.first_linked_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {typeof listing.description === 'string' && listing.description.trim() ? (
                <section className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Description</h3>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{listing.description}</p>
                </section>
              ) : null}

              <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">Media</h3>
                  <span className="text-xs text-gray-500">{media.length} image{media.length === 1 ? '' : 's'}</span>
                </div>
                {media.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No media URLs on this listing.</p>
                ) : (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {media.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" className="block group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="h-28 w-full rounded-lg object-cover bg-gray-100 ring-1 ring-gray-100 group-hover:opacity-90"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">Menu</h3>
                  <span className="text-xs text-gray-500">{menu.length} item{menu.length === 1 ? '' : 's'}</span>
                </div>
                {menu.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No menu items.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {menu.map((item, idx) => (
                      <li key={`${item.name}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package size={14} className="text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-900 truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-mono text-gray-800">
                          {fromMinor(item.price_minor, listing.currency_code)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Policies & booking</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Detail label="Deposit enabled" value={listing.deposit_enabled ? 'Yes' : 'No'} />
                  <Detail label="Deposit mode" value={String(listing.deposit_mode || '—')} />
                  <Detail
                    label="Deposit"
                    value={
                      listing.deposit_minor != null
                        ? fromMinor(listing.deposit_minor, listing.currency_code)
                        : listing.deposit_percent != null
                          ? `${listing.deposit_percent}%`
                          : '—'
                    }
                  />
                  <Detail
                    label="Travel fee"
                    value={
                      listing.travel_fee_minor != null
                        ? fromMinor(listing.travel_fee_minor, listing.currency_code)
                        : '—'
                    }
                  />
                  <Detail label="Cancellation" value={String(listing.cancellation_policy || '—')} />
                  <Detail label="Deposit policy" value={String(listing.deposit_policy || '—')} />
                  <Detail label="Allows booking requests" value={listing.allows_booking_requests ? 'Yes' : 'No'} />
                  <Detail label="Slug" value={String(listing.slug || '—')} mono />
                </dl>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4 flex items-center gap-2">
                  <User size={14} /> Seller
                </h3>
                <div className="flex items-start gap-3">
                  <AdminAvatar size="md" src={seller.logo_url} name={seller.display_name || 'Seller'} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{seller.display_name ?? '—'}</p>
                    <p className="text-sm text-gray-600 mt-0.5 truncate">{seller.email ?? '—'}</p>
                    <p className="text-sm text-gray-500 mt-1">@{seller.slug ?? '—'}</p>
                  </div>
                </div>
                {seller.phone ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <Phone size={14} className="text-gray-400" />
                    {seller.phone}
                  </p>
                ) : null}
                <div className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                  <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{locationLine}</p>
                    {sellerAreas.length > 0 ? (
                      <p className="text-xs text-gray-500 mt-1">Areas: {sellerAreas.join(', ')}</p>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/dashboard/users?q=${encodeURIComponent(seller.id)}`}
                  className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
                >
                  Open user dossier →
                </Link>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <ActionReasonModal
        open={moderateIntent !== null}
        title={moderateIntent === 'deactivate' ? 'Deactivate service listing' : 'Activate service listing'}
        description={
          moderateIntent === 'deactivate'
            ? 'This service listing will be hidden from active storefront surfaces.'
            : 'This service listing will become visible in storefront surfaces again.'
        }
        categoryOptions={[
          { value: 'policy_violation', label: 'Policy violation' },
          { value: 'fraud', label: 'Fraud risk' },
          { value: 'copyright', label: 'Copyright/IP concern' },
          { value: 'seller_request', label: 'Seller requested action' },
          { value: 'quality_issue', label: 'Quality/integrity issue' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={actionLoading}
        onClose={() => setModerateIntent(null)}
        onSubmit={runModeration}
      />
      <ActionReasonModal
        open={unlockIntent}
        title="Force unlock service listing content"
        description="Removes the listing content lock so the seller can edit title, media, menu, and description again. Use for verified support cases only."
        categoryOptions={[
          { value: 'seller_request', label: 'Seller support request' },
          { value: 'quality_issue', label: 'Incorrect lock / data issue' },
          { value: 'policy_violation', label: 'Moderation exception' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={actionLoading}
        onClose={() => setUnlockIntent(false)}
        onSubmit={runContentUnlock}
      />
    </div>
  )
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 px-2.5 py-1 text-[11px] font-bold ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-red-50 text-red-700 ring-red-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 break-all">{value}</p>
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
