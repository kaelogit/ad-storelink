'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Copy,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { parseApiError } from '../../../utils/http'

type LockedListing = {
  listing_type: 'product' | 'service'
  listing_id: string
  title?: string | null
  seller_id?: string | null
  seller_display_name?: string | null
  seller_slug?: string | null
  content_locked_at?: string | null
  linked_post_count?: number | null
  is_active?: boolean | null
  desk_path?: string | null
}

type DriftSignal = {
  id: string
  source_type?: string | null
  source_id?: string | null
  listing_type?: string | null
  listing_id?: string | null
  listing_title?: string | null
  seller_id?: string | null
  drift_fields?: unknown
  created_at?: string | null
  desk_path?: string | null
}

type IntegrityPayload = {
  summary?: {
    locked_products?: number
    locked_services?: number
    drift_signals_24h?: number
    drift_signals_7d?: number
  }
  locked_listings?: LockedListing[]
  drift_signals?: DriftSignal[]
}

const SUPPORT_MACROS = [
  {
    id: 'new-listing',
    title: 'Default: create new listing',
    body: `Your listing is locked because it is already tagged on posts (or it is older than 7 days). Title, photos, and description stay fixed so buyers see what was advertised.

You can still update stock, availability, and price within 20%.

To fully change how the listing looks, create a new product/service listing with the correct details, then tag new posts to that listing. Older posts keep pointing at the original listing (as shown when they were posted).`,
  },
  {
    id: 'tag-cap',
    title: 'Tag limit reached',
    body: `Each listing can be tagged on up to 10 active reels and stories at once. Active stories expire after 12 hours; reels count while they remain active.

Options: wait for older stories to expire, remove or archive older tagged reels, or create a new listing for new content.`,
  },
  {
    id: 'drift-buyer',
    title: 'Snapshot drift (buyer)',
    body: `The product details on the video are what was shown when the post was published. The live listing may have small allowed updates (for example price within 20%). If something looks wrong, share the post link and we will review it.`,
  },
] as const

function formatDate(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

function driftFieldsLabel(fields: unknown) {
  if (Array.isArray(fields)) return fields.map(String).join(', ') || '—'
  if (typeof fields === 'string') return fields
  return '—'
}

export default function ListingIntegrityPage() {
  const [payload, setPayload] = useState<IntegrityPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/listing-integrity/queue?limit=50')
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load listing integrity desk.')
      setFeedback({ tone: 'error', message: msg })
      setPayload(null)
      setLoading(false)
      return
    }
    const data = (await response.json()) as IntegrityPayload
    setPayload(data)
    setFeedback(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const summary = payload?.summary
  const locked = payload?.locked_listings ?? []
  const drift = payload?.drift_signals ?? []

  const copyMacro = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body)
      setCopiedId(id)
      setFeedback({ tone: 'success', message: 'Macro copied to clipboard.' })
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setFeedback({ tone: 'error', message: 'Could not copy macro.' })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Listing integrity"
        subtitle="Content locks, snapshot drift queue, and support macros for bait-and-switch prevention."
        actions={
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        }
      />

      <DeskLinkPills
        links={[
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/service-listings', label: 'Service listings' },
          { href: '/dashboard/support', label: 'Support' },
          { href: '/dashboard/feature-flags', label: 'Feature flags' },
          { href: '/dashboard/content-reports', label: 'Report inbox' },
        ]}
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Locked products" value={summary?.locked_products} icon={Lock} />
        <SummaryCard label="Locked services" value={summary?.locked_services} icon={Lock} />
        <SummaryCard label="Drift signals (24h)" value={summary?.drift_signals_24h} icon={AlertTriangle} />
        <SummaryCard label="Drift signals (7d)" value={summary?.drift_signals_7d} icon={AlertTriangle} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Policy constants</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase text-gray-400">Price change cap</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">±20% while locked</dd>
            <dd className="text-xs text-gray-500">App + DB guard (not a feature flag)</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-gray-400">Active tag cap</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">10 posts / listing</dd>
            <dd className="text-xs text-gray-500">
              Flag <code className="rounded bg-gray-100 px-1">listing_tag_cap</code> →{' '}
              <Link href="/dashboard/feature-flags" className="text-blue-600 hover:underline">
                Feature flags
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-gray-400">Rank dedupe</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">0.35× secondary tags</dd>
            <dd className="text-xs text-gray-500">Best tag per listing keeps full score</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-gray-400">Caption edit window</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">7 days</dd>
            <dd className="text-xs text-gray-500">Story edit = overlay text only (not stickers)</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Support macros</h2>
        </div>
        <p className="text-sm text-gray-600">
          Prefer a <strong>new listing</strong> over force unlock. Full playbook:{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">docs/SUPPORT_LISTING_CONTENT_LOCK.md</code>
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {SUPPORT_MACROS.map((macro) => (
            <div key={macro.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{macro.title}</p>
                <button
                  type="button"
                  onClick={() => void copyMacro(macro.id, macro.body)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Copy className="h-3 w-3" />
                  {copiedId === macro.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-6">{macro.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Locked listings</h2>
        </div>
        {loading && locked.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : locked.length === 0 ? (
          <EmptyState icon={Lock} message="No locked listings right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-bold text-gray-600">Type</th>
                  <th className="text-left p-3 font-bold text-gray-600">Title</th>
                  <th className="text-left p-3 font-bold text-gray-600">Seller</th>
                  <th className="text-left p-3 font-bold text-gray-600">Tags</th>
                  <th className="text-left p-3 font-bold text-gray-600">Locked at</th>
                  <th className="text-left p-3 font-bold text-gray-600">Active</th>
                </tr>
              </thead>
              <tbody>
                {locked.map((row) => (
                  <tr key={`${row.listing_type}-${row.listing_id}`} className="border-b border-gray-100 hover:bg-blue-50/60">
                    <td className="p-3 capitalize text-gray-700">{row.listing_type}</td>
                    <td className="p-3">
                      {row.desk_path ? (
                        <Link href={row.desk_path} className="font-semibold text-blue-600 hover:underline">
                          {row.title || row.listing_id}
                        </Link>
                      ) : (
                        row.title || row.listing_id
                      )}
                    </td>
                    <td className="p-3 text-gray-700">
                      {row.seller_id ? (
                        <Link
                          href={`/dashboard/users?q=${encodeURIComponent(row.seller_id)}`}
                          className="hover:underline"
                        >
                          {row.seller_display_name || row.seller_slug || row.seller_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-gray-700">{row.linked_post_count ?? 0}</td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(row.content_locked_at)}</td>
                    <td className="p-3">{row.is_active === false ? 'No' : 'Yes'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Snapshot drift queue</h2>
        </div>
        {loading && drift.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : drift.length === 0 ? (
          <EmptyState icon={AlertTriangle} message="No snapshot drift signals recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-bold text-gray-600">When</th>
                  <th className="text-left p-3 font-bold text-gray-600">Listing</th>
                  <th className="text-left p-3 font-bold text-gray-600">Source</th>
                  <th className="text-left p-3 font-bold text-gray-600">Fields</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                    <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="p-3">
                      {row.desk_path ? (
                        <Link href={row.desk_path} className="font-semibold text-blue-600 hover:underline">
                          {row.listing_title || row.listing_id}
                        </Link>
                      ) : (
                        row.listing_title || row.listing_id
                      )}
                      <div className="text-xs text-gray-500 capitalize">{row.listing_type}</div>
                    </td>
                    <td className="p-3 text-gray-700">
                      <span className="capitalize">{row.source_type}</span>
                      <div className="font-mono text-xs text-gray-500 break-all">{row.source_id}</div>
                    </td>
                    <td className="p-3 text-gray-700">{driftFieldsLabel(row.drift_fields)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value?: number
  icon: typeof Lock
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value ?? '—'}</p>
    </div>
  )
}
