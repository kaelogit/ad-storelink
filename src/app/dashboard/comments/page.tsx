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

type CommentReportRow = {
  report_id: string
  report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  report_reason: string
  report_details: string | null
  report_created_at: string
  reporter_id: string
  reporter_slug: string | null
  source_type: 'product' | 'service' | 'spotlight' | 'reel'
  context_id: string
  comment_id: string
  comment_content: string
  comment_author_id: string | null
  comment_author_slug: string | null
  comment_is_hidden: boolean
  comment_is_deleted: boolean
  context_title: string | null
  context_slug: string | null
}

type StatusCounts = {
  total: number
  open: number
  reviewing: number
  resolved: number
  dismissed: number
  by_source?: {
    product?: number
    service?: number
    spotlight?: number
    reel?: number
  }
}

const REASON_CATEGORIES = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'abuse', label: 'Abusive/unsafe content' },
  { value: 'spam', label: 'Spam/manipulation' },
  { value: 'copyright', label: 'Copyright complaint' },
  { value: 'appeal_resolution', label: 'Appeal resolution' },
  { value: 'other', label: 'Other' },
]

const SOURCE_LABELS: Record<CommentReportRow['source_type'], string> = {
  product: 'Product',
  service: 'Service',
  spotlight: 'Spotlight',
  reel: 'Reel',
}

const STATUS_TABS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const
const SOURCE_TABS = ['all', 'product', 'service', 'spotlight', 'reel'] as const

function contextUrl(row: CommentReportRow) {
  const slug = row.context_slug || row.context_id
  switch (row.source_type) {
    case 'product':
      return `https://storelink.ng/p/${encodeURIComponent(slug)}`
    case 'reel':
      return `https://storelink.ng/r/${encodeURIComponent(slug)}`
    case 'service':
      return `https://storelink.ng/service/${encodeURIComponent(slug)}`
    case 'spotlight':
      return `https://storelink.ng/sp/${encodeURIComponent(row.context_id)}`
    default:
      return '#'
  }
}

export default function CommentsModerationPage() {
  const [rows, setRows] = useState<CommentReportRow[]>([])
  const [counts, setCounts] = useState<StatusCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>('all')
  const [sourceTab, setSourceTab] = useState<(typeof SOURCE_TABS)[number]>('all')
  const [applyStrike, setApplyStrike] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeAction, setActiveAction] = useState<{
    row: CommentReportRow
    action: 'dismiss' | 'hide' | 'delete' | 'reinstate'
  } | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      status: statusTab,
      limit: '120',
      offset: '0',
    })
    if (sourceTab !== 'all') params.set('sourceType', sourceTab)
    const response = await fetch(`/api/admin/comments/reports/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load comment reports.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setCounts(null)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      rows?: CommentReportRow[]
      counts?: StatusCounts
    }
    setCounts(payload.counts ?? null)
    setRows(Array.isArray(payload.rows) ? payload.rows : [])
    setLoading(false)
  }, [sourceTab, statusTab])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const submitModeration = async ({ category, reason }: { category: string; reason: string }) => {
    if (!activeAction) return
    setSubmitting(true)
    setFeedback({ tone: 'info', message: `Applying ${activeAction.action} moderation action...` })

    const response = await fetch('/api/admin/comments/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: activeAction.row.source_type,
        commentId: activeAction.row.comment_id,
        reportId: activeAction.row.report_id,
        action: activeAction.action,
        reasonCategory: category,
        reason,
        applyStrike: applyStrike && ['hide', 'delete'].includes(activeAction.action),
      }),
    })

    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to moderate comment.')
      setFeedback({ tone: 'error', message: msg })
      setSubmitting(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { strike_applied?: boolean }
    const strikeNote = payload.strike_applied ? ' Trust strike applied.' : ''
    setFeedback({ tone: 'success', message: `Comment ${activeAction.action} action applied.${strikeNote}` })
    setActiveAction(null)
    setApplyStrike(false)
    setSubmitting(false)
    await loadReports()
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1.5 ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  const countForStatus = (tab: (typeof STATUS_TABS)[number]) => {
    if (!counts) return null
    if (tab === 'all') return counts.total
    return counts[tab]
  }

  const countForSource = (tab: (typeof SOURCE_TABS)[number]) => {
    if (!counts) return null
    if (tab === 'all') return counts.total
    return counts.by_source?.[tab] ?? 0
  }

  const actionTitle = () => {
    switch (activeAction?.action) {
      case 'dismiss':
        return 'Dismiss comment report?'
      case 'hide':
        return 'Hide comment?'
      case 'delete':
        return 'Delete comment?'
      case 'reinstate':
        return 'Reinstate comment?'
      default:
        return 'Moderate comment?'
    }
  }

  const showStrikeOption = activeAction && ['hide', 'delete'].includes(activeAction.action)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comments Moderation"
        subtitle="Unified queue for product, service, spotlight, and reel comment reports."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/content-reports', label: 'Report Inbox' },
              { href: '/dashboard/spotlight', label: 'Spotlight' },
              { href: '/dashboard/reels', label: 'Reels' },
            ]}
          />
        }
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {counts && counts.total === 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Desk is live — <span className="font-bold">0</span> comment reports filed yet. Reports appear here when a user
          reports a comment in the app (product / service / spotlight / reel).
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const n = countForStatus(tab)
              return (
                <button key={tab} type="button" className={tabClass(statusTab === tab)} onClick={() => setStatusTab(tab)}>
                  <span className="capitalize">{tab}</span>
                  {n != null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                        statusTab === tab ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
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
        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCE_TABS.map((source) => {
            const n = countForSource(source)
            return (
              <button
                key={source}
                type="button"
                className={tabClass(sourceTab === source)}
                onClick={() => setSourceTab(source)}
              >
                {source === 'all' ? 'All sources' : SOURCE_LABELS[source]}
                {n != null ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      sourceTab === source ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {n}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading comment reports...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No comment reports"
            message={
              counts && counts.total === 0
                ? 'Nobody has reported a comment yet. The queue is empty, not broken.'
                : `Nothing in “${statusTab}”${sourceTab !== 'all' ? ` / ${sourceTab}` : ''}. Try All.`
            }
            icon={ShieldAlert}
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Report</DataTableHead>
                <DataTableHead>Comment</DataTableHead>
                <DataTableHead>Source</DataTableHead>
                <DataTableHead>Status</DataTableHead>
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
                      <p className="line-clamp-2 text-gray-700">{row.comment_content}</p>
                      <p className="text-gray-500">
                        {row.comment_author_id ? (
                          <Link
                            href={`/dashboard/users?q=${encodeURIComponent(row.comment_author_id)}`}
                            className="hover:underline"
                          >
                            @{row.comment_author_slug || 'author'}
                          </Link>
                        ) : (
                          <>@{row.comment_author_slug || 'author'}</>
                        )}
                      </p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="space-y-1 text-xs">
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">
                        {SOURCE_LABELS[row.source_type]}
                      </span>
                      <p className="line-clamp-1 text-gray-700">{row.context_title || row.context_id.slice(0, 8)}</p>
                      <a
                        href={contextUrl(row)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Eye className="h-3 w-3" /> Open source
                      </a>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700">
                      {row.report_status}
                      {row.comment_is_hidden ? ' / hidden' : ''}
                      {row.comment_is_deleted ? ' / deleted' : ''}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setApplyStrike(false)
                          setActiveAction({ row, action: 'dismiss' })
                        }}
                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyStrike(false)
                          setActiveAction({ row, action: 'hide' })
                        }}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyStrike(false)
                          setActiveAction({ row, action: 'delete' })
                        }}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyStrike(false)
                          setActiveAction({ row, action: 'reinstate' })
                        }}
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
        description="Comment moderation is logged to the admin audit trail."
        impactSummary={showStrikeOption ? 'Hide/delete can optionally add a trust strike on the comment author.' : undefined}
        extraFields={
          showStrikeOption ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={applyStrike}
                onChange={(e) => setApplyStrike(e.target.checked)}
                className="rounded border-gray-300"
              />
              Apply trust strike to @{activeAction?.row.comment_author_slug || 'author'}
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
