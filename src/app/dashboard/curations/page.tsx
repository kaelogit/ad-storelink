'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ExternalLink,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  StarOff,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
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
import { createClient } from '../../../utils/supabase/client'
import type { AdminRole } from '../../../types/admin'
import type { CurationHubRow } from '../../api/admin/curations/list/route'

type HubDetail = {
  hub_kind: 'product' | 'service'
  hub_ref_id: string
  curator_user_id: string
  curator_display_name: string | null
  curator_slug: string | null
  curator_email: string | null
  hub_title: string | null
  hub_description: string | null
  image_url: string | null
  completed_at: string | null
  order_id: string | null
  price_minor: number | null
  currency_code: string | null
  seller_display_name: string | null
  seller_slug: string | null
  is_owner_hidden: boolean
  is_admin_hidden: boolean
  is_featured: boolean
  is_wardrobe_private: boolean
  is_publicly_visible: boolean
  preview_path: string
}

type PendingAction = {
  row: CurationHubRow
  action: 'hide' | 'feature'
}

const REASON_CATEGORIES = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'privacy_request', label: 'Privacy request' },
  { value: 'editorial_feature', label: 'Editorial feature' },
  { value: 'abuse', label: 'Abuse / safety' },
  { value: 'other', label: 'Other' },
]

const PUBLIC_ORIGIN = 'https://storelink.ng'

export default function CurationsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const curatorFromUrl = searchParams.get('curatorId')?.trim() || ''

  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [rows, setRows] = useState<CurationHubRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'product' | 'service'>('all')
  const [hiddenOnly, setHiddenOnly] = useState(false)
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [curatorFilter, setCuratorFilter] = useState('')
  const [selected, setSelected] = useState<CurationHubRow | null>(null)
  const [detail, setDetail] = useState<HubDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canModerate = adminRole === 'super_admin' || adminRole === 'moderator' || adminRole === 'content'

  useEffect(() => {
    if (curatorFromUrl) setCuratorFilter(curatorFromUrl)
  }, [curatorFromUrl])

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted && data?.role) setAdminRole(data.role as AdminRole)
    }
    void loadRole()
    return () => { mounted = false }
  }, [supabase])

  const loadHubs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      q: query.trim(),
      limit: '150',
      offset: '0',
    })
    if (kindFilter !== 'all') params.set('kind', kindFilter)
    if (hiddenOnly) params.set('hidden', '1')
    if (featuredOnly) params.set('featured', '1')
    if (curatorFilter.trim()) params.set('curatorId', curatorFilter.trim())

    const response = await fetch(`/api/admin/curations/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load curation hubs.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json()) as { rows?: CurationHubRow[] }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [query, kindFilter, hiddenOnly, featuredOnly, curatorFilter])

  useEffect(() => {
    void loadHubs()
  }, [loadHubs])

  const loadDetail = useCallback(async (row: CurationHubRow) => {
    setDetailLoading(true)
    setDetail(null)
    const params = new URLSearchParams({
      curatorId: row.curator_user_id,
      kind: row.hub_kind,
      refId: row.hub_ref_id,
    })
    const response = await fetch(`/api/admin/curations/detail?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load hub detail.')
      setFeedback({ tone: 'error', message: msg })
      setDetailLoading(false)
      return
    }
    const payload = (await response.json()) as { hub?: HubDetail }
    setDetail(payload.hub ?? null)
    setDetailLoading(false)
  }, [])

  const openHub = (row: CurationHubRow) => {
    setSelected(row)
    void loadDetail(row)
  }

  const previewUrl = useMemo(() => {
    if (!detail?.preview_path) return null
    return `${PUBLIC_ORIGIN}${detail.preview_path}`
  }, [detail?.preview_path])

  const runModeration = async (
    row: CurationHubRow,
    action: 'hide' | 'unhide' | 'feature' | 'unfeature',
    opts?: { category: string; reason: string },
  ) => {
    setSubmitting(true)
    setFeedback({ tone: 'info', message: `Applying ${action}...` })
    const response = await fetch('/api/admin/curations/moderate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `curation-${action}-${row.curator_user_id}-${row.hub_kind}-${row.hub_ref_id}`,
      },
      body: JSON.stringify({
        curatorId: row.curator_user_id,
        hubKind: row.hub_kind,
        hubRefId: row.hub_ref_id,
        action,
        reasonCategory: opts?.category,
        reason: opts?.reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Moderation action failed.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }
    const payload = (await response.json()) as { hub?: HubDetail }
    setFeedback({ tone: 'success', message: `Curation hub ${action} applied.` })
    setPendingAction(null)
    setSubmitting(false)
    if (payload.hub) setDetail(payload.hub)
    await loadHubs()
    if (selected) {
      const updated = rows.find(
        (r) =>
          r.curator_user_id === row.curator_user_id &&
          r.hub_kind === row.hub_kind &&
          r.hub_ref_id === row.hub_ref_id,
      )
      if (updated) setSelected(updated)
    }
  }

  const submitReasonAction = async ({ category, reason }: { category: string; reason: string }) => {
    if (!pendingAction) return
    return runModeration(pendingAction.row, pendingAction.action, { category, reason })
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curation Hubs"
        subtitle="Browse buyer curation hubs from completed purchases. Preview public pages, hide from profile, or mark editorial features."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, curator, hub id, order id..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
            placeholder="Filter by curator UUID"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 lg:w-72"
          />
          <button
            type="button"
            onClick={() => void loadHubs()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={tabClass(kindFilter === 'all')} onClick={() => setKindFilter('all')}>All kinds</button>
          <button className={tabClass(kindFilter === 'product')} onClick={() => setKindFilter('product')}>Products</button>
          <button className={tabClass(kindFilter === 'service')} onClick={() => setKindFilter('service')}>Services</button>
          <button className={tabClass(hiddenOnly)} onClick={() => setHiddenOnly((v) => !v)}>Hidden / private</button>
          <button className={tabClass(featuredOnly)} onClick={() => setFeaturedOnly((v) => !v)}>Featured only</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading curation hubs...
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={LayoutGrid} message="No curation hubs match your filters." />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Hub</DataTableHead>
                  <DataTableHead>Curator</DataTableHead>
                  <DataTableHead>Visibility</DataTableHead>
                  <DataTableHead>Completed</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {rows.map((row) => {
                  const isSelected =
                    selected?.hub_ref_id === row.hub_ref_id &&
                    selected?.curator_user_id === row.curator_user_id &&
                    selected?.hub_kind === row.hub_kind
                  return (
                    <DataTableRow
                      key={`${row.curator_user_id}-${row.hub_kind}-${row.hub_ref_id}`}
                      className={isSelected ? 'bg-blue-50/60' : 'cursor-pointer hover:bg-gray-50'}
                      onClick={() => openHub(row)}
                    >
                      <DataTableCell>
                        <div className="flex items-center gap-3">
                          {row.image_url ? (
                            <img src={row.image_url} alt="" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
                              N/A
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{row.hub_title || 'Untitled hub'}</p>
                            <p className="text-[10px] font-mono text-gray-500">
                              {row.hub_kind} · {row.hub_ref_id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={`/dashboard/users?userId=${row.curator_user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          @{row.curator_slug || 'user'}
                        </Link>
                        <p className="text-[10px] text-gray-500">{row.curator_email || row.curator_user_id.slice(0, 8)}</p>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.is_featured ? <StatusBadge tone="success" label="Featured" /> : null}
                          {row.is_admin_hidden ? <StatusBadge tone="danger" label="Admin hidden" /> : null}
                          {row.is_owner_hidden ? <StatusBadge tone="warning" label="Owner hidden" /> : null}
                          {row.is_wardrobe_private ? <StatusBadge tone="neutral" label="Wardrobe private" /> : null}
                          {row.is_publicly_visible ? <StatusBadge tone="success" label="Public" /> : null}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <p className="text-xs text-gray-600">
                          {row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—'}
                        </p>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 min-h-[320px]">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-500 py-16">
              <LayoutGrid className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Select a hub to preview and moderate.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading detail...
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {detail.image_url ? (
                <img src={detail.image_url} alt="" className="h-40 w-full rounded-xl border border-gray-200 object-cover" />
              ) : null}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{detail.hub_kind} curation</p>
                <h3 className="text-lg font-black text-gray-900">{detail.hub_title}</h3>
                {detail.hub_description ? (
                  <p className="mt-2 text-xs text-gray-600 line-clamp-4">{detail.hub_description}</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs space-y-1">
                <p><span className="font-semibold text-gray-500">Curator:</span> @{detail.curator_slug || 'user'}</p>
                <p><span className="font-semibold text-gray-500">Seller:</span> @{detail.seller_slug || 'seller'}</p>
                <p><span className="font-semibold text-gray-500">Order:</span> <span className="font-mono">{detail.order_id?.slice(0, 8) || '—'}</span></p>
                <p><span className="font-semibold text-gray-500">Hub ref:</span> <span className="font-mono break-all">{detail.hub_ref_id}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.is_featured ? <StatusBadge tone="success" label="Featured" /> : null}
                {detail.is_admin_hidden ? <StatusBadge tone="danger" label="Admin hidden" /> : null}
                {detail.is_publicly_visible ? <StatusBadge tone="success" label="On public profile" /> : <StatusBadge tone="warning" label="Not on public profile" />}
              </div>
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open public preview
                </a>
              ) : null}
              {canModerate ? (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  {detail.is_admin_hidden ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void runModeration(selected, 'unhide')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> Show on profile
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPendingAction({ row: selected, action: 'hide' })}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-2 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <EyeOff className="h-3.5 w-3.5" /> Hide from profile
                    </button>
                  )}
                  {detail.is_featured ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void runModeration(selected, 'unfeature')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <StarOff className="h-3.5 w-3.5" /> Unfeature
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPendingAction({ row: selected, action: 'feature' })}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-200 px-2 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <Star className="h-3.5 w-3.5" /> Feature
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Read-only for your role. Content/moderator can apply actions.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">Could not load hub detail.</p>
          )}
        </div>
      </div>

      <ActionReasonModal
        open={pendingAction !== null}
        title={pendingAction?.action === 'hide' ? 'Hide curation from public profile?' : 'Feature this curation hub?'}
        description="Provide a reason for this content moderation action. It will be written to the audit log."
        impactSummary={
          pendingAction?.action === 'hide'
            ? 'Hub will be removed from the curator public profile collection (admin override). Direct share links may still work.'
            : 'Hub will be marked as editorially featured for admin tracking and future discovery surfaces.'
        }
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setPendingAction(null)}
        onSubmit={submitReasonAction}
      />
    </div>
  )
}
