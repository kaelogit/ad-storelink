'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Megaphone, Power, RefreshCcw, Search } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ConfirmActionModal } from '../../../components/admin/ConfirmActionModal'
import { AdminAvatar } from '../../../components/admin/AdminAvatar'
import { AdsConfigEditor } from '../../../components/admin/AdsConfigEditor'
import { AdCreativeReviewModal } from '../../../components/admin/AdCreativeReviewModal'
import { EmptyState } from '../../../components/admin/EmptyState'
import { StatusBadge } from '../../../components/admin/StatusBadge'
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
import { useAdminRole } from '../../../hooks/useAdminRole'

function queueAgeLabel(iso?: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m in queue`
  if (h < 48) return `${h}h in queue`
  return `${Math.floor(h / 24)}d in queue`
}

function isSlaBreached(iso?: string | null, hours = 24): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > hours * 3_600_000
}

type AdCampaignRow = {
  id: string
  name: string
  status: string
  objective?: string | null
  budget_minor: number
  spent_minor: number
  spend_pct?: number | null
  currency_code?: string | null
  placements?: string[] | null
  creative_type: string
  reel_id?: string | null
  product_id?: string | null
  service_listing_id?: string | null
  image_url?: string | null
  headline?: string | null
  deeplink?: string | null
  country_code: string
  moderation_state?: string | null
  rejection_reason?: string | null
  refund_status?: string | null
  refunded_minor?: number | null
  refunded_at?: string | null
  refund_method?: string | null
  payment_reference?: string | null
  created_at?: string | null
  updated_at?: string | null
  advertiser_type?: string | null
  seller_id?: string | null
  seller_slug?: string | null
  seller_display_name?: string | null
  seller_logo_url?: string | null
  impressions_billable?: number
  clicks?: number
  ui_label?: string | null
}

type ConfirmAction = {
  campaignId: string
  action: 'approve' | 'pause' | 'resume' | 'end'
  name: string
}

type PlatformGate = {
  enabled: boolean
  rolloutPercent: number
  canToggle: boolean
}

const STATUS_FILTERS = [
  { value: 'pending_review', label: 'Under review' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ended', label: 'Ended' },
  { value: 'draft', label: 'Draft' },
  { value: 'all', label: 'All' },
] as const

const REJECT_CATEGORIES = [
  { value: 'prohibited_content', label: 'Prohibited content' },
  { value: 'misleading', label: 'Misleading / scammy' },
  { value: 'creative_quality', label: 'Creative quality' },
  { value: 'policy_other', label: 'Other policy' },
]

const CREDIT_CATEGORIES = [
  { value: 'reject_before_delivery', label: 'Rejected before delivery' },
  { value: 'unused_budget', label: 'Unused budget (paused/ended)' },
  { value: 'policy_dispute', label: 'Policy / dispute goodwill' },
  { value: 'platform_fault', label: 'Delivery shortfall / platform fault' },
]

function unusedMinor(row: AdCampaignRow): number {
  return Math.max(0, Number(row.budget_minor || 0) - Number(row.spent_minor || 0))
}

function canIssueCredit(row: AdCampaignRow): boolean {
  if (row.advertiser_type === 'platform') return false
  if (row.refund_status === 'credited') return false
  if (!['rejected', 'paused', 'ended'].includes(row.status)) return false
  return unusedMinor(row) >= 100
}

function moneyMinor(minor: number, currency = 'NGN') {
  const main = Number(minor || 0) / 100
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(main)
  } catch {
    return `${main}`
  }
}

function statusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  if (status === 'active') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'rejected') return 'danger'
  if (status === 'paused') return 'info'
  if (status === 'ended') return 'neutral'
  return 'neutral'
}

function creativePreview(row: AdCampaignRow) {
  if (row.creative_type === 'image') {
    return { label: row.headline || row.name || 'House banner', href: row.deeplink || null }
  }
  if (row.creative_type === 'product' && row.product_id) {
    return { label: 'Product', href: `/dashboard/products/${row.product_id}` }
  }
  if (row.creative_type === 'service' && row.service_listing_id) {
    return { label: 'Service', href: `/dashboard/service-listings/${row.service_listing_id}` }
  }
  if (row.creative_type === 'reel' && row.reel_id) {
    return { label: 'Reel', href: `/dashboard/reels?q=${encodeURIComponent(row.reel_id)}` }
  }
  return { label: row.creative_type, href: null }
}

export default function AdsCampaignsPage() {
  const { countryCode } = useCountryFilter()
  const { canWrite, role } = useAdminRole()
  const canEditAdsConfig = role === 'super_admin'
  const [status, setStatus] = useState<string>('pending_review')
  const [advertiserType, setAdvertiserType] = useState<'all' | 'seller' | 'platform'>('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdCampaignRow[]>([])
  const [pendingReview, setPendingReview] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviewTarget, setReviewTarget] = useState<AdCampaignRow | null>(null)
  const [bulkAction, setBulkAction] = useState<'approve' | 'pause' | 'resume' | 'end' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )
  const [rejectTarget, setRejectTarget] = useState<AdCampaignRow | null>(null)
  const [creditTarget, setCreditTarget] = useState<AdCampaignRow | null>(null)
  const [creditAmountMinor, setCreditAmountMinor] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [gate, setGate] = useState<PlatformGate | null>(null)
  const [gateLoading, setGateLoading] = useState(true)
  const [gateBusy, setGateBusy] = useState(false)
  const [pendingGate, setPendingGate] = useState<{ enabled: boolean; rolloutPercent: number } | null>(
    null,
  )

  const loadGate = useCallback(async () => {
    setGateLoading(true)
    const res = await fetch('/api/admin/ads/platform-gate')
    if (!res.ok) {
      setGate(null)
      setGateLoading(false)
      return
    }
    const data = await res.json()
    setGate({
      enabled: Boolean(data.enabled),
      rolloutPercent: Number(data.rolloutPercent || 0),
      canToggle: Boolean(data.canToggle),
    })
    setGateLoading(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    const params = new URLSearchParams({
      status,
      advertiserType,
      limit: '80',
      offset: '0',
    })
    if (countryCode !== ALL_COUNTRIES_CODE) params.set('country', countryCode)
    if (query.trim()) params.set('q', query.trim())

    const res = await fetch(`/api/admin/ads/list?${params.toString()}`)
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Failed to load campaigns.') })
      setRows([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setRows(Array.isArray(data?.campaigns) ? data.campaigns : [])
    setPendingReview(Number(data?.pendingReview || 0))
    setTotal(Number(data?.total || 0))
    setSelectedIds(new Set())
    setLoading(false)
  }, [status, advertiserType, countryCode, query])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(rows.map((r) => r.id)))
  }

  const runBulk = async () => {
    if (!bulkAction || selectedIds.size === 0) return
    setBulkBusy(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map((campaignId) =>
        fetch('/api/admin/ads/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, action: bulkAction }),
        }).then(async (res) => {
          if (!res.ok) throw new Error(await parseApiError(res, 'Failed'))
          return campaignId
        }),
      ),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const fail = results.length - ok
    setFeedback({
      tone: fail ? 'error' : 'success',
      message: `Bulk ${bulkAction}: ${ok} ok${fail ? `, ${fail} failed` : ''}.`,
    })
    setBulkBusy(false)
    setBulkAction(null)
    await load()
  }

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadGate()
  }, [loadGate])

  const moderate = async (campaignId: string, action: string, reason?: string, reasonCategory?: string) => {
    setBusyId(campaignId)
    setFeedback({ tone: 'info', message: `${action}…` })
    const res = await fetch('/api/admin/ads/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, action, reason, reasonCategory }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Moderation failed.') })
      setBusyId(null)
      return
    }
    const data = await res.json().catch(() => ({}))
    if (action === 'reject' && data?.refund?.ok) {
      const coins = data.refund.coinsCredited
      setFeedback({
        tone: 'success',
        message: `Campaign rejected. Auto-credited ${coins ?? '?'} Store Coins for unused package.`,
      })
    } else if (action === 'reject' && data?.refundError) {
      setFeedback({
        tone: 'error',
        message: `Campaign rejected, but credit failed: ${data.refundError}. Use Issue credit to retry.`,
      })
    } else {
      setFeedback({ tone: 'success', message: `Campaign ${action}d.` })
    }
    setBusyId(null)
    setConfirmAction(null)
    await load()
  }

  const submitGate = async (payload: { category: string; reason: string }) => {
    if (!pendingGate) return
    setGateBusy(true)
    try {
      const res = await fetch('/api/admin/ads/platform-gate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          enabled: pendingGate.enabled,
          rolloutPercent: pendingGate.rolloutPercent,
          reason: `[${payload.category}] ${payload.reason.trim()}`,
        }),
      })
      if (!res.ok) {
        setFeedback({ tone: 'error', message: await parseApiError(res, 'Failed to update ads gate.') })
        return
      }
      setFeedback({
        tone: 'success',
        message: pendingGate.enabled
          ? `Ads enabled at ${pendingGate.rolloutPercent}% rollout.`
          : 'Ads platform gate turned off.',
      })
      setPendingGate(null)
      await loadGate()
    } finally {
      setGateBusy(false)
    }
  }

  const issueCredit = async (campaignId: string, reason: string, amountMinor: number | null) => {
    setBusyId(campaignId)
    setFeedback({ tone: 'info', message: 'Issuing store-coin credit…' })
    const res = await fetch('/api/admin/ads/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId,
        reason,
        amountMinor,
      }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Credit failed.') })
      setBusyId(null)
      return
    }
    const data = await res.json().catch(() => ({}))
    const coins = data?.coinsCredited
    setFeedback({
      tone: 'success',
      message: data?.idempotent
        ? 'Already credited earlier (idempotent).'
        : `Credited ${coins ?? '?'} Store Coins for unused Boost budget.`,
    })
    setBusyId(null)
    setCreditTarget(null)
    await load()
  }

  const summary = useMemo(
    () => `${pendingReview} under review · showing ${rows.length}${total ? ` of ${total}` : ''}`,
    [pendingReview, rows.length, total],
  )

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ad campaigns"
        subtitle="Approve seller Boosts, pause delivery, issue unused credits, and control the global ads kill switch."
        actions={
          <div className="flex gap-2">
            <Link
              href="/dashboard/ads/reporting"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Reporting
            </Link>
            <Link
              href="/dashboard/house-ads"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              House ads
            </Link>
            <button
              type="button"
              onClick={() => {
                void load()
                void loadGate()
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <strong>Launch hold:</strong> Keep platform ads <em>off</em> until go-live. Do not use Turn on /
        Ramp here yet — review and pause tools still work while delivery stays gated.
      </div>

      {(canEditAdsConfig || role === 'analyst') ? (
        <AdsConfigEditor canEdit={canEditAdsConfig} onUpdated={() => void loadGate()} />
      ) : null}

      <div
        className={`rounded-xl border p-4 ${
          gate?.enabled && (gate.rolloutPercent || 0) > 0
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-amber-200 bg-amber-50/60'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 shadow-sm">
              <Power className="h-4 w-4 text-zinc-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Platform ads gate (`ads_enabled`)</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {gateLoading
                  ? 'Loading…'
                  : gate?.enabled && gate.rolloutPercent > 0
                    ? `Live — ${gate.rolloutPercent}% rollout. Seller Boosts and house ads can deliver.`
                    : 'Off — campaigns stay reviewable, but delivery is blocked until you turn this on.'}
              </p>
              {!gate?.canToggle ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Super Admin can toggle here. Others:{' '}
                  <Link href="/dashboard/feature-flags" className="underline">
                    Feature Flags
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>
          {gate?.canToggle ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={gateBusy || gateLoading}
                onClick={() => setPendingGate({ enabled: true, rolloutPercent: 100 })}
                className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                Turn on (100%)
              </button>
              <button
                type="button"
                disabled={gateBusy || gateLoading}
                onClick={() => setPendingGate({ enabled: true, rolloutPercent: 5 })}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Ramp 5%
              </button>
              <button
                type="button"
                disabled={gateBusy || gateLoading}
                onClick={() => setPendingGate({ enabled: false, rolloutPercent: 0 })}
                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Kill switch off
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
        <Megaphone className="h-4 w-4" />
        <span>{summary}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              status === opt.value
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-zinc-200 text-zinc-600'
            }`}
          >
            {opt.label}
            {opt.value === 'pending_review' && pendingReview > 0 ? ` (${pendingReview})` : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={advertiserType}
          onChange={(e) => setAdvertiserType(e.target.value as 'all' | 'seller' | 'platform')}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All advertisers</option>
          <option value="seller">Sellers</option>
          <option value="platform">House / platform</option>
        </select>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, seller, campaign id"
            className="w-full rounded-md border border-zinc-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {canWrite && selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <span className="font-semibold text-blue-900">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkAction('approve')}
            className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-800"
          >
            Bulk approve
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkAction('pause')}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
          >
            Bulk pause
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkAction('resume')}
            className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-800"
          >
            Bulk resume
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkAction('end')}
            className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700"
          >
            Bulk end
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-blue-700 underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No campaigns" message="Nothing matches these filters." />
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead className="w-10">
                {canWrite ? (
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.size === rows.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                ) : null}
              </DataTableHead>
              <DataTableHead>Campaign</DataTableHead>
              <DataTableHead>Creative</DataTableHead>
              <DataTableHead>Spend</DataTableHead>
              <DataTableHead>Delivery</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => {
              const preview = creativePreview(row)
              const busy = busyId === row.id
              const age = queueAgeLabel(row.created_at)
              const slaHot = row.status === 'pending_review' && isSlaBreached(row.created_at, 24)
              return (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    {canWrite ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex max-w-[260px] items-start gap-2.5">
                      {row.advertiser_type !== 'platform' ? (
                        <AdminAvatar
                          src={row.seller_logo_url}
                          name={row.seller_display_name || row.seller_slug || row.seller_id}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">{row.name || 'Untitled'}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {row.advertiser_type === 'platform'
                            ? 'House'
                            : row.seller_slug
                              ? `@${row.seller_slug}`
                              : row.seller_display_name || 'Seller'}{' '}
                          · {row.country_code}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">{row.id}</p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      {row.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.image_url} alt="" className="h-10 w-14 rounded object-cover" />
                      ) : null}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setReviewTarget(row)}
                          className="text-sm text-emerald-700 hover:underline"
                        >
                          Review creative
                        </button>
                        {preview.href ? (
                          <Link href={preview.href} className="block text-xs text-zinc-500 hover:underline">
                            {preview.label}
                          </Link>
                        ) : (
                          <p className="truncate text-xs text-zinc-500">{preview.label}</p>
                        )}
                        <p className="truncate text-[11px] text-zinc-400">
                          {(row.placements || []).join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <p className="text-sm text-zinc-800">
                      {row.budget_minor === 0
                        ? 'Unlimited'
                        : `${moneyMinor(row.spent_minor, row.currency_code || 'NGN')} / ${moneyMinor(
                            row.budget_minor,
                            row.currency_code || 'NGN',
                          )}`}
                    </p>
                    {row.spend_pct != null ? (
                      <p className="text-xs text-zinc-500">{row.spend_pct}% spent</p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <p className="text-sm text-zinc-800">{row.impressions_billable ?? 0} imps</p>
                    <p className="text-xs text-zinc-500">{row.clicks ?? 0} clicks</p>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={statusTone(row.status)} label={row.ui_label || row.status} />
                    {age ? (
                      <p className={`mt-1 text-[11px] ${slaHot ? 'font-semibold text-red-600' : 'text-zinc-500'}`}>
                        {age}
                        {slaHot ? ' · SLA' : ''}
                      </p>
                    ) : null}
                    {row.rejection_reason ? (
                      <p className="mt-1 max-w-[160px] truncate text-[11px] text-zinc-500">
                        {row.rejection_reason}
                      </p>
                    ) : null}
                    {row.refund_status === 'credited' ? (
                      <p className="mt-1 text-[11px] text-emerald-700">
                        Credited {moneyMinor(Number(row.refunded_minor || 0), row.currency_code || 'NGN')}
                      </p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {!canWrite ? (
                        <span className="text-[11px] text-zinc-400">Read only</span>
                      ) : null}
                      {canWrite && row.status === 'pending_review' ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setConfirmAction({
                                campaignId: row.id,
                                action: 'approve',
                                name: row.name || 'campaign',
                              })
                            }
                            className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRejectTarget(row)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {canWrite && row.status === 'active' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirmAction({
                              campaignId: row.id,
                              action: 'pause',
                              name: row.name || 'campaign',
                            })
                          }
                          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                        >
                          Pause
                        </button>
                      ) : null}
                      {canWrite && row.status === 'paused' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirmAction({
                              campaignId: row.id,
                              action: 'resume',
                              name: row.name || 'campaign',
                            })
                          }
                          className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Resume
                        </button>
                      ) : null}
                      {canWrite &&
                      (row.status === 'active' || row.status === 'paused' || row.status === 'pending_review') ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirmAction({
                              campaignId: row.id,
                              action: 'end',
                              name: row.name || 'campaign',
                            })
                          }
                          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                        >
                          End
                        </button>
                      ) : null}
                      {canWrite && canIssueCredit(row) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setCreditAmountMinor(String(unusedMinor(row)))
                            setCreditTarget(row)
                          }}
                          className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Issue credit
                        </button>
                      ) : null}
                      {row.seller_id ? (
                        <Link
                          href={`/dashboard/users?q=${encodeURIComponent(row.seller_id)}`}
                          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600"
                        >
                          Seller
                        </Link>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      <ConfirmActionModal
        open={!!bulkAction}
        title={`Bulk ${bulkAction || 'action'}`}
        description={`Apply ${bulkAction} to ${selectedIds.size} campaign(s). Each action is audited.`}
        impactSummary="Runs in parallel via moderate_ad_campaign. Failures are reported per batch."
        danger={bulkAction === 'end'}
        confirmLabel={`Confirm ${bulkAction || 'action'}`}
        submitting={bulkBusy}
        onClose={() => setBulkAction(null)}
        onConfirm={() => void runBulk()}
      />

      <AdCreativeReviewModal
        open={!!reviewTarget}
        row={reviewTarget}
        canWrite={canWrite}
        onClose={() => setReviewTarget(null)}
        onApprove={() => {
          if (!reviewTarget) return
          setReviewTarget(null)
          setConfirmAction({
            campaignId: reviewTarget.id,
            action: 'approve',
            name: reviewTarget.name || 'campaign',
          })
        }}
        onReject={() => {
          if (!reviewTarget) return
          setRejectTarget(reviewTarget)
          setReviewTarget(null)
        }}
      />

      <ConfirmActionModal
        open={!!confirmAction}
        title={
          confirmAction?.action === 'approve'
            ? 'Approve campaign'
            : confirmAction?.action === 'pause'
              ? 'Pause campaign'
              : confirmAction?.action === 'resume'
                ? 'Resume campaign'
                : 'End campaign'
        }
        description={`Confirm ${confirmAction?.action || 'action'} for “${confirmAction?.name || 'campaign'}”.`}
        impactSummary={
          confirmAction?.action === 'approve'
            ? 'Campaign can start delivering if ads_enabled is on.'
            : confirmAction?.action === 'pause'
              ? 'Delivery stops immediately. You can resume later from this desk.'
              : confirmAction?.action === 'resume'
                ? 'Campaign returns to active delivery (still gated by ads_enabled).'
                : 'Campaign ends permanently. Unused budget can still be credited.'
        }
        danger={confirmAction?.action === 'end'}
        confirmLabel={
          confirmAction?.action === 'approve'
            ? 'Approve'
            : confirmAction?.action === 'pause'
              ? 'Pause'
              : confirmAction?.action === 'resume'
                ? 'Resume'
                : 'End campaign'
        }
        submitting={!!busyId}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return
          await moderate(confirmAction.campaignId, confirmAction.action)
        }}
      />

      <ActionReasonModal
        open={!!pendingGate}
        title={pendingGate?.enabled ? 'Enable platform ads' : 'Turn off platform ads'}
        description={
          pendingGate?.enabled
            ? `Enable ads_enabled at ${pendingGate.rolloutPercent}% rollout.`
            : 'Disable ads_enabled (0% rollout). All delivery stops; review queues stay available.'
        }
        impactSummary={
          pendingGate?.enabled
            ? 'Approved campaigns and house ads may begin serving to users in the rollout cohort.'
            : 'Kill switch — no paid or house ads deliver until re-enabled.'
        }
        categoryOptions={[
          { value: 'launch', label: 'Launch / ramp' },
          { value: 'incident', label: 'Incident response' },
          { value: 'policy', label: 'Policy / compliance' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={gateBusy}
        onClose={() => setPendingGate(null)}
        onSubmit={submitGate}
      />

      <ActionReasonModal
        open={!!rejectTarget}
        title="Reject campaign"
        description={`Reject “${rejectTarget?.name || 'campaign'}”. Seller will be notified with your reason.`}
        impactSummary={
          rejectTarget &&
          Number(rejectTarget.spent_minor || 0) === 0 &&
          Number(rejectTarget.budget_minor || 0) > 0
            ? 'Unused package will be auto-credited as Store Coins (reject before delivery).'
            : undefined
        }
        categoryOptions={REJECT_CATEGORIES}
        submitting={!!busyId}
        onClose={() => setRejectTarget(null)}
        onSubmit={async ({ category, reason }) => {
          if (!rejectTarget) return
          await moderate(rejectTarget.id, 'reject', reason, category)
          setRejectTarget(null)
        }}
      />

      <ActionReasonModal
        open={!!creditTarget}
        title="Issue store-coin credit"
        description={`Credit unused Boost budget for “${creditTarget?.name || 'campaign'}” as Store Coins (1 coin = 1 major currency unit).`}
        impactSummary={
          creditTarget
            ? `Unused: ${moneyMinor(unusedMinor(creditTarget), creditTarget.currency_code || 'NGN')} → up to ${Math.floor(unusedMinor(creditTarget) / 100)} coins.`
            : undefined
        }
        categoryOptions={CREDIT_CATEGORIES}
        submitting={!!busyId}
        extraFields={
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
              Amount (minor units, optional)
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={creditAmountMinor}
              onChange={(e) => setCreditAmountMinor(e.target.value)}
              placeholder="Defaults to full unused"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Leave as unused total, or enter a lower minor amount.</p>
          </div>
        }
        onClose={() => setCreditTarget(null)}
        onSubmit={async ({ category, reason }) => {
          if (!creditTarget) return
          const parsed = creditAmountMinor.trim() ? Number(creditAmountMinor) : null
          const amount =
            parsed != null && Number.isFinite(parsed) ? Math.floor(parsed) : unusedMinor(creditTarget)
          await issueCredit(
            creditTarget.id,
            `[${category}] ${reason}`,
            amount,
          )
        }}
      />
    </div>
  )
}
