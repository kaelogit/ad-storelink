'use client'

import { useCallback, useEffect, useState } from 'react'
import { Compass, Eye, Info, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'

type ReelReportRow = {
  report_id: string
  report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  report_reason: string
  report_details: string | null
  report_created_at: string
  reporter_id: string
  reporter_slug: string | null
  reel_id: string
  reel_short_code: string | null
  reel_caption: string | null
  reel_moderation_state: 'active' | 'hidden' | 'removed'
  seller_id: string | null
  seller_slug: string | null
}

type DiscoverReelRow = {
  reel_id: string
  reel_short_code: string | null
  reel_caption: string | null
  reel_created_at: string
  reel_moderation_state: 'active' | 'hidden' | 'removed'
  views_count: number
  seller_id: string | null
  seller_slug: string | null
  product_id: string | null
  product_name: string | null
  product_is_active: boolean
  discover_eligible: boolean
  ineligible_reasons: string[] | null
  open_report_count: number
}

type DiscoverSummary = {
  discover_eligible_count?: number
  moderated_hidden_count?: number
  moderated_removed_count?: number
  open_report_count?: number
}

const REASON_CATEGORIES = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'abuse', label: 'Abusive/unsafe content' },
  { value: 'spam', label: 'Spam/manipulation' },
  { value: 'copyright', label: 'Copyright complaint' },
  { value: 'appeal_resolution', label: 'Appeal resolution' },
  { value: 'other', label: 'Other' },
]

const ELIGIBILITY_SURFACES = [
  { rpc: 'get_simple_explore_shuffle', surface: 'Explore shuffle feed' },
  { rpc: 'get_explore_for_you', surface: 'Explore For You (followed sellers)' },
  { rpc: 'get_discover_mosaic_page', surface: 'Discover mosaic (reel tiles)' },
  { rpc: 'search_discover_unified', surface: 'Discover search (reels scope)' },
]

function reelPreviewUrl(shortCode: string | null, reelId: string) {
  const code = (shortCode || reelId || '').trim()
  return `https://storelink.ng/r/${encodeURIComponent(code)}`
}

type ActiveAction =
  | { mode: 'discover'; row: DiscoverReelRow; action: 'hide' | 'remove' | 'reinstate' }
  | { mode: 'report'; row: ReelReportRow; action: 'dismiss' | 'hide' | 'remove' | 'reinstate' }

export default function ReelsModerationPage() {
  const [deskTab, setDeskTab] = useState<'discover' | 'reports'>('discover')
  const [discoverRows, setDiscoverRows] = useState<DiscoverReelRow[]>([])
  const [reportRows, setReportRows] = useState<ReelReportRow[]>([])
  const [discoverScope, setDiscoverScope] = useState<'discover_eligible' | 'moderated' | 'all_recent'>('discover_eligible')
  const [reportStatus, setReportStatus] = useState<'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'>('open')
  const [summary, setSummary] = useState<DiscoverSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [applyStrike, setApplyStrike] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null)

  const loadDiscover = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ scope: discoverScope, limit: '120', offset: '0' })
    const response = await fetch(`/api/admin/reels/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load discover feed reels.')
      setFeedback({ tone: 'error', message: msg })
      setDiscoverRows([])
      setSummary(null)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: DiscoverReelRow[]; summary?: DiscoverSummary }
    setDiscoverRows(Array.isArray(payload.rows) ? payload.rows : [])
    setSummary(payload.summary ?? null)
    setLoading(false)
  }, [discoverScope])

  const loadReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: reportStatus, limit: '120', offset: '0' })
    const response = await fetch(`/api/admin/reels/reports/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load Reels reports.')
      setFeedback({ tone: 'error', message: msg })
      setReportRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: ReelReportRow[] }
    setReportRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [reportStatus])

  const refresh = useCallback(async () => {
    if (deskTab === 'discover') await loadDiscover()
    else await loadReports()
  }, [deskTab, loadDiscover, loadReports])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitModeration = async ({ category, reason }: { category: string; reason: string }) => {
    if (!activeAction) return
    setSubmitting(true)
    setFeedback({ tone: 'info', message: `Applying ${activeAction.action} moderation action...` })

    const reelId = activeAction.mode === 'discover' ? activeAction.row.reel_id : activeAction.row.reel_id
    const reportId = activeAction.mode === 'report' ? activeAction.row.report_id : null
    const strikeEligible = ['hide', 'remove'].includes(activeAction.action)

    const response = await fetch('/api/admin/reels/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reelId,
        reportId,
        action: activeAction.action,
        reasonCategory: category,
        reason,
        applyStrike: applyStrike && strikeEligible,
      }),
    })

    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to moderate reel.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { seller_notified?: boolean; strike_applied?: boolean }
    const notifyNote = payload.seller_notified ? ' Seller notified.' : ''
    const strikeNote = payload.strike_applied ? ' Trust strike applied.' : ''
    setFeedback({ tone: 'success', message: `Reel ${activeAction.action} action applied.${notifyNote}${strikeNote}` })
    setActiveAction(null)
    setApplyStrike(false)
    setSubmitting(false)
    await refresh()
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const showStrikeOption =
    !!activeAction && ['hide', 'remove'].includes(activeAction.action)

  const actionTitle = () => {
    if (!activeAction) return 'Moderate reel?'
    switch (activeAction.action) {
      case 'dismiss':
        return 'Dismiss reel report?'
      case 'hide':
        return 'Hide reel from discover feeds?'
      case 'remove':
        return 'Remove reel from discover feeds?'
      case 'reinstate':
        return 'Reinstate reel to discover feeds?'
      default:
        return 'Moderate reel?'
    }
  }

  const actionDescription = () => {
    if (!activeAction) return ''
    switch (activeAction.action) {
      case 'dismiss':
        return 'Closes the report without changing reel visibility.'
      case 'hide':
        return 'Sets moderation_state to hidden. Reel drops out of Explore, Discover mosaic, and Discover search immediately.'
      case 'remove':
        return 'Sets moderation_state to removed. Reel drops out of all discover/explore surfaces immediately.'
      case 'reinstate':
        return 'Restores moderation_state to active if the linked product and seller subscription remain eligible.'
      default:
        return ''
    }
  }

  const sellerSlugForStrike =
    activeAction?.mode === 'discover'
      ? activeAction.row.seller_slug
      : activeAction?.mode === 'report'
        ? activeAction.row.seller_slug
        : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover & Reels Moderation"
        subtitle="Monitor reels live in Explore/Discover feeds, review reports, and apply hide/remove with optional trust strikes."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-2 text-xs text-blue-900">
            <p className="font-bold">Discover / Explore eligibility impact</p>
            <p>
              Reels only surface when <code className="rounded bg-white/80 px-1">reels.moderation_state = active</code>.
              Hide or remove immediately excludes the reel from all primary discovery RPCs below.
              Reinstate restores eligibility when the product is active and the seller subscription is valid.
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {ELIGIBILITY_SURFACES.map((item) => (
                <li key={item.rpc}>
                  <span className="font-semibold">{item.surface}</span>
                  {' — '}
                  <code className="rounded bg-white/80 px-1">{item.rpc}</code>
                </li>
              ))}
            </ul>
            {summary && (
              <p className="pt-1 font-medium">
                Live: {summary.discover_eligible_count ?? 0} eligible · {summary.moderated_hidden_count ?? 0} hidden ·{' '}
                {summary.moderated_removed_count ?? 0} removed · {summary.open_report_count ?? 0} open reports
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className={tabClass(deskTab === 'discover')} onClick={() => setDeskTab('discover')}>
              <span className="inline-flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                Discover feed
              </span>
            </button>
            <button className={tabClass(deskTab === 'reports')} onClick={() => setDeskTab('reports')}>
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Reports
              </span>
            </button>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        {deskTab === 'discover' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={tabClass(discoverScope === 'discover_eligible')} onClick={() => setDiscoverScope('discover_eligible')}>
              Live in feeds
            </button>
            <button className={tabClass(discoverScope === 'moderated')} onClick={() => setDiscoverScope('moderated')}>
              Hidden / removed
            </button>
            <button className={tabClass(discoverScope === 'all_recent')} onClick={() => setDiscoverScope('all_recent')}>
              All recent
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {(['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const).map((status) => (
              <button key={status} className={tabClass(reportStatus === status)} onClick={() => setReportStatus(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : deskTab === 'discover' ? (
          discoverRows.length === 0 ? (
            <EmptyState
              title="No reels in this view"
              message="No reels match the current discover feed filter."
              icon={Compass}
            />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Reel</DataTableHead>
                  <DataTableHead>Product</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Seller</DataTableHead>
                  <DataTableHead>Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {discoverRows.map((row) => (
                  <DataTableRow key={row.reel_id}>
                    <DataTableCell>
                      <div className="space-y-1 text-xs">
                        <p className="line-clamp-2 text-gray-700">{row.reel_caption || 'No caption'}</p>
                        <div className="flex flex-wrap items-center gap-2 text-gray-500">
                          <span>/{row.reel_short_code || row.reel_id.slice(0, 8)}</span>
                          <span>{row.views_count.toLocaleString()} views</span>
                          {row.open_report_count > 0 && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              {row.open_report_count} open report{row.open_report_count === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <a
                          href={reelPreviewUrl(row.reel_short_code, row.reel_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Eye className="h-3 w-3" /> Open reel
                        </a>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-700">{row.product_name || '—'}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="space-y-1">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                          {row.reel_moderation_state}
                        </span>
                        {row.discover_eligible ? (
                          <p className="text-[10px] font-semibold text-emerald-700">Discover eligible</p>
                        ) : (
                          <p className="text-[10px] text-amber-700">
                            {(row.ineligible_reasons || []).join(', ') || 'Not eligible'}
                          </p>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'discover', row, action: 'hide' }) }}
                          className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                        >
                          Hide
                        </button>
                        <button
                          onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'discover', row, action: 'remove' }) }}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                        >
                          Remove
                        </button>
                        {row.reel_moderation_state !== 'active' && (
                          <button
                            onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'discover', row, action: 'reinstate' }) }}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )
        ) : reportRows.length === 0 ? (
          <EmptyState
            title="No Reels reports"
            message="No reports match this filter right now."
            icon={ShieldAlert}
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Report</DataTableHead>
                <DataTableHead>Reel</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Seller</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {reportRows.map((row) => (
                <DataTableRow key={row.report_id}>
                  <DataTableCell>
                    <div className="text-xs text-gray-700">
                      <p className="font-bold uppercase">{row.report_reason}</p>
                      <p className="text-gray-500">@{row.reporter_slug || 'user'}</p>
                      <p className="text-[11px] text-gray-400">{new Date(row.report_created_at).toLocaleString()}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="space-y-1 text-xs">
                      <p className="line-clamp-2 text-gray-700">{row.reel_caption || 'No caption'}</p>
                      <div className="flex gap-2">
                        <span className="text-gray-700">/{row.reel_short_code || row.reel_id.slice(0, 8)}</span>
                        <a
                          href={reelPreviewUrl(row.reel_short_code, row.reel_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Eye className="h-3 w-3" /> Open reel
                        </a>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                      {row.report_status} / {row.reel_moderation_state}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'report', row, action: 'dismiss' }) }}
                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'report', row, action: 'hide' }) }}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'report', row, action: 'remove' }) }}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => { setApplyStrike(false); setActiveAction({ mode: 'report', row, action: 'reinstate' }) }}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                      >
                        Reinstate
                      </button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </div>

      <ActionReasonModal
        open={!!activeAction}
        title={actionTitle()}
        description={actionDescription()}
        impactSummary={
          showStrikeOption
            ? 'Hide/remove drops the reel from Explore and Discover surfaces. Optionally add a trust strike on the seller.'
            : 'Action is logged to admin audit trail.'
        }
        extraFields={
          showStrikeOption ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={applyStrike}
                onChange={(e) => setApplyStrike(e.target.checked)}
                className="rounded border-gray-300"
              />
              Apply trust strike to @{sellerSlugForStrike || 'seller'}
            </label>
          ) : undefined
        }
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => {
          setActiveAction(null)
          setApplyStrike(false)
        }}
        onSubmit={submitModeration}
      />
    </div>
  )
}
