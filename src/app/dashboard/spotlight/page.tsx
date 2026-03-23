'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'

type SpotlightReportRow = {
  report_id: string
  report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  report_reason: string
  report_details: string | null
  report_created_at: string
  reporter_id: string
  reporter_slug: string | null
  spotlight_post_id: string
  post_caption: string | null
  post_moderation_state: 'active' | 'hidden' | 'removed'
  creator_id: string
  creator_slug: string | null
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

export default function SpotlightModerationPage() {
  const [rows, setRows] = useState<SpotlightReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusTab, setStatusTab] = useState<'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'>('open')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeAction, setActiveAction] = useState<{ row: SpotlightReportRow; action: 'hide' | 'remove' | 'reinstate' } | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      status: statusTab,
      limit: '120',
      offset: '0',
    })
    const response = await fetch(`/api/admin/spotlight/reports/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load Spotlight reports.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as { rows?: SpotlightReportRow[] }
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [statusTab])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const submitModeration = async ({ category, reason }: { category: string; reason: string }) => {
    if (!activeAction) return
    setSubmitting(true)
    setFeedback({ tone: 'info', message: `Applying ${activeAction.action} moderation action...` })

    const response = await fetch('/api/admin/spotlight/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotlightPostId: activeAction.row.spotlight_post_id,
        reportId: activeAction.row.report_id,
        action: activeAction.action,
        reasonCategory: category,
        reason,
      }),
    })

    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to moderate Spotlight post.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }

    setFeedback({ tone: 'success', message: `Spotlight post ${activeAction.action} action applied.` })
    setActiveAction(null)
    setSubmitting(false)
    await loadReports()
  }

  const tabClass = (tab: typeof statusTab) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      tab === statusTab ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spotlight Moderation"
        subtitle="Review Spotlight reports, apply hide/remove/reinstate actions, and keep trust surfaces clean."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className={tabClass('open')} onClick={() => setStatusTab('open')}>Open</button>
            <button className={tabClass('reviewing')} onClick={() => setStatusTab('reviewing')}>Reviewing</button>
            <button className={tabClass('resolved')} onClick={() => setStatusTab('resolved')}>Resolved</button>
            <button className={tabClass('dismissed')} onClick={() => setStatusTab('dismissed')}>Dismissed</button>
            <button className={tabClass('all')} onClick={() => setStatusTab('all')}>All</button>
          </div>
          <button
            onClick={() => void loadReports()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading Spotlight reports...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No Spotlight reports"
            message="No reports match this filter right now."
            icon={ShieldAlert}
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Report</DataTableHead>
                <DataTableHead>Post</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Seller</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row) => (
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
                      <p className="line-clamp-2 text-gray-700">{row.post_caption || 'No caption'}</p>
                      <div className="flex gap-2">
                        <span className="text-gray-700">Creator @{row.creator_slug || 'user'}</span>
                        <a
                          href={`https://storelink.ng/spotlight/${row.spotlight_post_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Eye className="h-3 w-3" /> Open post
                        </a>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                      {row.report_status} / {row.post_moderation_state}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction({ row, action: 'hide' })}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => setActiveAction({ row, action: 'remove' })}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setActiveAction({ row, action: 'reinstate' })}
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
        title={
          activeAction?.action === 'hide'
            ? 'Hide Spotlight post?'
            : activeAction?.action === 'remove'
            ? 'Remove Spotlight post?'
            : 'Reinstate Spotlight post?'
        }
        description="This action updates Spotlight moderation state and closes the linked report."
        impactSummary="Action is logged to admin audit trail."
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => setActiveAction(null)}
        onSubmit={submitModeration}
      />
    </div>
  )
}
