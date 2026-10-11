'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
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

type StatusCounts = {
  total: number
  open: number
  reviewing: number
  resolved: number
  dismissed: number
}

const REASON_CATEGORIES = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'abuse', label: 'Abusive/unsafe content' },
  { value: 'spam', label: 'Spam/manipulation' },
  { value: 'copyright', label: 'Copyright complaint' },
  { value: 'appeal_resolution', label: 'Appeal resolution' },
  { value: 'other', label: 'Other' },
]

const TABS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const

export default function SpotlightModerationPage() {
  const [rows, setRows] = useState<SpotlightReportRow[]>([])
  const [counts, setCounts] = useState<StatusCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusTab, setStatusTab] = useState<(typeof TABS)[number]>('all')
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
      setCounts(null)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      rows?: SpotlightReportRow[]
      counts?: StatusCounts
    }
    setCounts(payload.counts ?? null)
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [statusTab])

  useEffect(() => {
    void loadReports()
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
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1.5 ${
      tab === statusTab ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const countFor = (tab: (typeof TABS)[number]) => {
    if (!counts) return null
    if (tab === 'all') return counts.total
    return counts[tab]
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spotlight Moderation"
        subtitle="Review Spotlight reports, apply hide/remove/reinstate actions, and keep trust surfaces clean."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/content-reports', label: 'Report Inbox' },
              { href: '/dashboard/reels', label: 'Reels' },
              { href: '/dashboard/comments', label: 'Comments' },
            ]}
          />
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {counts && counts.total > 0 && counts.open === 0 && statusTab === 'open' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No open Spotlight reports. {counts.dismissed} dismissed · {counts.resolved} resolved ·{' '}
          <button type="button" className="font-bold underline" onClick={() => setStatusTab('all')}>
            Show all ({counts.total})
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const n = countFor(tab)
              return (
                <button key={tab} type="button" className={tabClass(tab)} onClick={() => setStatusTab(tab)}>
                  <span className="capitalize">{tab}</span>
                  {n != null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                        tab === statusTab ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {n}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <button
            type="button"
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
            message={
              counts && counts.total > 0
                ? `Nothing in “${statusTab}”. Switch tabs — ${counts.total} report(s) exist in total.`
                : 'No Spotlight reports have been filed yet.'
            }
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
                      <p className="text-gray-500">
                        {row.reporter_id ? (
                          <Link href={`/dashboard/users?q=${encodeURIComponent(row.reporter_id)}`} className="hover:underline">
                            @{row.reporter_slug || 'user'}
                          </Link>
                        ) : (
                          <>@{row.reporter_slug || 'user'}</>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">{new Date(row.report_created_at).toLocaleString()}</p>
                      {row.report_details ? (
                        <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{row.report_details}</p>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="space-y-1 text-xs">
                      <p className="line-clamp-2 text-gray-700">{row.post_caption || 'No caption'}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-gray-700">Creator @{row.creator_slug || 'user'}</span>
                        {row.spotlight_post_id ? (
                          <a
                            href={`https://storelink.ng/sp/${row.spotlight_post_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Eye className="h-3 w-3" /> Open post
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                      {row.report_status} / {row.post_moderation_state}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    {row.seller_id ? (
                      <Link
                        href={`/dashboard/users?q=${encodeURIComponent(row.seller_id)}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        @{row.seller_slug || 'store'}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-700">@{row.seller_slug || 'store'}</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveAction({ row, action: 'hide' })}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction({ row, action: 'remove' })}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
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
