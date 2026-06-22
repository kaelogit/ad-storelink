'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Eye, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'

type StoryRow = {
  story_id: string
  story_type: string | null
  story_text: string | null
  media_url: string | null
  story_created_at: string
  story_expires_at: string
  story_moderation_state: 'active' | 'hidden' | 'removed'
  views_count: number
  seller_id: string | null
  seller_slug: string | null
  open_report_count: number
}

type StoryReportRow = {
  report_id: string
  report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  report_reason: string
  report_details: string | null
  report_created_at: string
  reporter_id: string
  reporter_slug: string | null
  story_id: string
  story_type: string | null
  story_text: string | null
  story_expires_at: string
  story_moderation_state: 'active' | 'hidden' | 'removed'
  seller_id: string | null
  seller_slug: string | null
}

const REASON_CATEGORIES = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'abuse', label: 'Abusive/unsafe content' },
  { value: 'spam', label: 'Spam/manipulation' },
  { value: 'copyright', label: 'Copyright complaint' },
  { value: 'appeal_resolution', label: 'Appeal resolution' },
  { value: 'other', label: 'Other' },
]

function storyPreviewUrl(storyId: string) {
  return `https://storelink.ng/story-viewer/${encodeURIComponent(storyId)}`
}

function formatExpiry(expiresAt: string) {
  const expires = new Date(expiresAt)
  const msLeft = expires.getTime() - Date.now()
  if (msLeft <= 0) return 'Expired'
  const hours = Math.floor(msLeft / (1000 * 60 * 60))
  if (hours < 24) return `${hours}h left`
  const days = Math.floor(hours / 24)
  return `${days}d left`
}

type ActiveAction =
  | { mode: 'story'; row: StoryRow; action: 'hide' | 'remove' | 'reinstate' }
  | { mode: 'report'; row: StoryReportRow; action: 'dismiss' | 'hide' | 'remove' | 'reinstate' }

export default function StoriesModerationPage() {
  const [deskTab, setDeskTab] = useState<'live' | 'reports'>('live')
  const [storyRows, setStoryRows] = useState<StoryRow[]>([])
  const [reportRows, setReportRows] = useState<StoryReportRow[]>([])
  const [storyScope, setStoryScope] = useState<'live' | 'moderated' | 'all_recent'>('live')
  const [reportStatus, setReportStatus] = useState<'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'>('open')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null)

  const loadStories = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ scope: storyScope, limit: '120', offset: '0' })
    const response = await fetch(`/api/admin/stories/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load live stories.')
      setFeedback({ tone: 'error', message: msg })
      setStoryRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: StoryRow[] }
    setStoryRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [storyScope])

  const loadReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: reportStatus, limit: '120', offset: '0' })
    const response = await fetch(`/api/admin/stories/reports/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load story reports.')
      setFeedback({ tone: 'error', message: msg })
      setReportRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: StoryReportRow[] }
    setReportRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [reportStatus])

  const refresh = useCallback(async () => {
    if (deskTab === 'live') await loadStories()
    else await loadReports()
  }, [deskTab, loadReports, loadStories])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitModeration = async ({ category, reason }: { category: string; reason: string }) => {
    if (!activeAction) return
    setSubmitting(true)
    setFeedback({ tone: 'info', message: `Applying ${activeAction.action} moderation action...` })

    const storyId = activeAction.mode === 'story' ? activeAction.row.story_id : activeAction.row.story_id
    const reportId = activeAction.mode === 'report' ? activeAction.row.report_id : null

    const response = await fetch('/api/admin/stories/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId,
        reportId,
        action: activeAction.action,
        reasonCategory: category,
        reason,
      }),
    })

    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to moderate story.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { seller_notified?: boolean }
    const notifyNote = payload.seller_notified ? ' Seller notified.' : ''
    setFeedback({ tone: 'success', message: `Story ${activeAction.action} action applied.${notifyNote}` })
    setActiveAction(null)
    setSubmitting(false)
    await refresh()
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const actionTitle = () => {
    if (!activeAction) return 'Moderate story?'
    if (activeAction.action === 'dismiss') return 'Dismiss story report?'
    if (activeAction.action === 'hide') return 'Hide story?'
    if (activeAction.action === 'remove') return 'Remove story?'
    return 'Reinstate story?'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stories Moderation"
        subtitle="Review live stories and reports. Expired stories drop off the live list automatically."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className={tabClass(deskTab === 'live')} onClick={() => setDeskTab('live')}>Live stories</button>
            <button className={tabClass(deskTab === 'reports')} onClick={() => setDeskTab('reports')}>Reports</button>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        {deskTab === 'live' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={tabClass(storyScope === 'live')} onClick={() => setStoryScope('live')}>Live only</button>
            <button className={tabClass(storyScope === 'moderated')} onClick={() => setStoryScope('moderated')}>Hidden/removed</button>
            <button className={tabClass(storyScope === 'all_recent')} onClick={() => setStoryScope('all_recent')}>All recent</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={tabClass(reportStatus === 'open')} onClick={() => setReportStatus('open')}>Open</button>
            <button className={tabClass(reportStatus === 'reviewing')} onClick={() => setReportStatus('reviewing')}>Reviewing</button>
            <button className={tabClass(reportStatus === 'resolved')} onClick={() => setReportStatus('resolved')}>Resolved</button>
            <button className={tabClass(reportStatus === 'dismissed')} onClick={() => setReportStatus('dismissed')}>Dismissed</button>
            <button className={tabClass(reportStatus === 'all')} onClick={() => setReportStatus('all')}>All</button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading stories...
          </div>
        ) : deskTab === 'live' ? (
          storyRows.length === 0 ? (
            <EmptyState title="No live stories" message="No stories match this filter. Expired stories are excluded from Live only." icon={Clock} />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Story</DataTableHead>
                  <DataTableHead>Seller</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Reports</DataTableHead>
                  <DataTableHead>Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {storyRows.map((row) => (
                  <DataTableRow key={row.story_id}>
                    <DataTableCell>
                      <div className="space-y-1 text-xs">
                        <p className="line-clamp-2 text-gray-700">{row.story_text || row.story_type || 'Media story'}</p>
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatExpiry(row.story_expires_at)}</span>
                          <a
                            href={storyPreviewUrl(row.story_id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Eye className="h-3 w-3" /> Open
                          </a>
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                        {row.story_moderation_state}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-xs text-gray-700">{row.open_report_count}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setActiveAction({ mode: 'story', row, action: 'hide' })}
                          className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                        >
                          Hide
                        </button>
                        <button
                          onClick={() => setActiveAction({ mode: 'story', row, action: 'remove' })}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setActiveAction({ mode: 'story', row, action: 'reinstate' })}
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
          )
        ) : reportRows.length === 0 ? (
          <EmptyState title="No story reports" message="No reports match this filter right now." icon={ShieldAlert} />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Report</DataTableHead>
                <DataTableHead>Story</DataTableHead>
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
                      <p className="line-clamp-2 text-gray-700">{row.story_text || row.story_type || 'Media story'}</p>
                      <a
                        href={storyPreviewUrl(row.story_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Eye className="h-3 w-3" /> Open story
                      </a>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                      {row.report_status} / {row.story_moderation_state}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction({ mode: 'report', row, action: 'dismiss' })}
                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => setActiveAction({ mode: 'report', row, action: 'hide' })}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => setActiveAction({ mode: 'report', row, action: 'remove' })}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setActiveAction({ mode: 'report', row, action: 'reinstate' })}
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
        description="Story moderation is logged to the admin audit trail."
        impactSummary="Hide/remove notifies the seller when applicable."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setActiveAction(null)}
        onSubmit={submitModeration}
      />
    </div>
  )
}
