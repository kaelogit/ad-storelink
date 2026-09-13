'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import { useAdminRole } from '../../../hooks/useAdminRole'
import { AssigneeChip, useQueueAssignments } from '../../../hooks/useQueueAssignments'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'

type ReportRow = {
  report_id: string
  report_type: 'spotlight' | 'reel' | 'comment' | 'profile' | 'chat' | 'group' | 'policy'
  report_subtype?: string | null
  report_status: string
  report_reason?: string | null
  report_details?: string | null
  report_created_at?: string | null
  admin_reviewed_at?: string | null
  age_hours?: number | null
  sla_breached?: boolean
  reporter_id?: string | null
  reporter_slug?: string | null
  subject_user_id?: string | null
  subject_slug?: string | null
  context_id?: string | null
  context_title?: string | null
  context_slug?: string | null
  moderation_state?: string | null
  desk_path?: string | null
}

type InboxPayload = {
  config?: { slaTargetHours?: number; notes?: string | null }
  summary?: {
    openTotal?: number
    slaBreachedOpen?: number
    reports24h?: number
    avgResolutionHours7d?: number
    openByType?: Record<string, number>
    policyFalsePositiveRate7d?: number | null
  }
  rows?: ReportRow[]
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'reel', label: 'Reels' },
  { value: 'comment', label: 'Comments' },
  { value: 'profile', label: 'Profiles' },
  { value: 'chat', label: 'Chat' },
  { value: 'group', label: 'Communities' },
  { value: 'policy', label: 'ML policy' },
] as const

const STATUS_OPTIONS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const

const TYPE_LABELS: Record<string, string> = {
  spotlight: 'Spotlight',
  reel: 'Reel',
  comment: 'Comment',
  profile: 'Profile',
  chat: 'Chat',
  group: 'Community',
  policy: 'ML policy',
}

function deskHref(row: ReportRow) {
  const base = row.desk_path || '/dashboard/moderator'
  if (row.report_type === 'policy') return base
  if (row.report_type === 'group') {
    if (row.context_id) return `/dashboard/groups?groupId=${encodeURIComponent(row.context_id)}`
    return base.includes('/dashboard/groups') ? base : '/dashboard/groups'
  }
  if (row.report_type === 'profile' || row.report_type === 'chat') {
    if (row.report_type === 'chat' && row.context_id) {
      return `/dashboard/chats?chatId=${encodeURIComponent(row.context_id)}`
    }
    if (row.subject_user_id) return `/dashboard/users?q=${encodeURIComponent(row.subject_user_id)}`
  }
  if (row.report_type === 'reel') return `${base}?tab=reports`
  return base
}

function formatFpRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(Number(rate))) return '—'
  return `${(Number(rate) * 100).toFixed(1)}%`
}

function statusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  if (status === 'open') return 'danger'
  if (status === 'reviewing') return 'warning'
  if (status === 'resolved') return 'success'
  if (status === 'dismissed') return 'neutral'
  return 'info'
}

export default function ContentReportsInboxPage() {
  const { canWrite } = useAdminRole()
  const [payload, setPayload] = useState<InboxPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [query, setQuery] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [selected, setSelected] = useState<ReportRow | null>(null)
  const [resolving, setResolving] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkDismissOpen, setBulkDismissOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      type: typeFilter,
      status: statusFilter,
      limit: '100',
    })
    if (query.trim()) params.set('q', query.trim())

    const response = await fetch(`/api/admin/content-reports/inbox?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load content reports inbox.')
      setFeedback({ tone: 'error', message: msg })
      setPayload(null)
      setLoading(false)
      return
    }

    const data = (await response.json()) as InboxPayload
    setPayload(data)
    setLoading(false)
  }, [typeFilter, statusFilter, query])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const resolvePolicyFlag = useCallback(
    async (outcome: 'true_positive' | 'false_positive' | 'inconclusive') => {
      if (!selected || selected.report_type !== 'policy') return
      setResolving(true)
      setFeedback(null)
      const response = await fetch('/api/admin/content-reports/policy-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: selected.report_id, outcome }),
      })
      if (!response.ok) {
        const msg = await parseApiError(response, 'Failed to resolve policy flag.')
        setFeedback({ tone: 'error', message: msg })
        setResolving(false)
        return
      }
      setFeedback({
        tone: 'success',
        message: `Policy flag marked ${outcome.replace(/_/g, ' ')}.`,
      })
      setSelected(null)
      setResolving(false)
      await loadInbox()
    },
    [selected, loadInbox],
  )

  const rows = payload?.rows ?? []
  const summary = payload?.summary
  const slaTarget = payload?.config?.slaTargetHours ?? 24

  const typeCounts = useMemo(() => summary?.openByType ?? {}, [summary?.openByType])
  const reportIds = useMemo(() => rows.map((r) => r.report_id), [rows])
  const assignments = useQueueAssignments('content_report', reportIds)

  const rowKey = (row: ReportRow) => `${row.report_type}:${row.report_id}`

  const runBulkDismiss = async (payloadIn: { category: string; reason: string }) => {
    const items = rows
      .filter((r) => selectedKeys.has(rowKey(r)))
      .map((r) => ({ reportId: r.report_id, reportType: r.report_type }))
    if (items.length === 0) return
    setBulkBusy(true)
    const res = await fetch('/api/admin/content-reports/bulk-triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dismiss',
        reason: `[${payloadIn.category}] ${payloadIn.reason}`,
        items,
      }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Bulk dismiss failed.') })
      setBulkBusy(false)
      return
    }
    const data = await res.json()
    setFeedback({
      tone: data.failCount ? 'error' : 'success',
      message: `Bulk dismiss: ${data.okCount} ok${data.failCount ? `, ${data.failCount} failed` : ''}.`,
    })
    setSelectedKeys(new Set())
    setBulkDismissOpen(false)
    setBulkBusy(false)
    await loadInbox()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content reports inbox"
        subtitle="One queue for user reports and ML borderline policy flags — triage here, action in the surface desk."
        actions={
          <div className="flex flex-col items-end gap-2">
            <DeskLinkPills
              links={[
                { href: '/dashboard/moderator', label: 'Moderation Hub' },
                { href: '/dashboard/reels', label: 'Reels' },
                { href: '/dashboard/comments', label: 'Comments' },
                { href: '/dashboard/chats', label: 'P2P chats' },
                { href: '/dashboard/groups', label: 'Communities' },
              ]}
            />
            <button
              type="button"
              onClick={() => void loadInbox()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      {(summary?.slaBreachedOpen ?? 0) > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900">
            <span className="font-bold">{summary?.slaBreachedOpen}</span> open report(s) exceed the {slaTarget}h SLA target.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <SummaryCard label="Open queue" value={String(summary?.openTotal ?? 0)} />
        <SummaryCard label="SLA breached" value={String(summary?.slaBreachedOpen ?? 0)} alert={(summary?.slaBreachedOpen ?? 0) > 0} />
        <SummaryCard label="Reports (24h)" value={String(summary?.reports24h ?? 0)} />
        <SummaryCard
          label="Avg resolution (7d)"
          value={`${Number(summary?.avgResolutionHours7d ?? 0).toFixed(1)}h`}
          hint="Spotlight / reel / comment / policy"
        />
        <SummaryCard
          label="ML FP rate (7d)"
          value={formatFpRate(summary?.policyFalsePositiveRate7d)}
          hint="false_positive / reviewed policy flags"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold border transition ${
                typeFilter === opt.value
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {opt.value !== 'all' && typeCounts[opt.value] != null ? (
                <span className="ml-1 opacity-80">({typeCounts[opt.value]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
        <form
          className="flex flex-1 min-w-[200px] max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(searchDraft.trim())
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search reason, slug, caption…"
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white">
            Search
          </button>
        </form>
        {canWrite && selectedKeys.size > 0 ? (
          <button
            type="button"
            onClick={() => setBulkDismissOpen(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
          >
            Bulk dismiss ({selectedKeys.size})
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {loading && !payload ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No reports match filters"
              message="Try a broader status filter or switch report type."
            />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead className="w-10" />
                  <DataTableHead>Type</DataTableHead>
                  <DataTableHead>Context</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Age / SLA</DataTableHead>
                  <DataTableHead>Assignee</DataTableHead>
                  <DataTableHead>Desk</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={`${row.report_type}-${row.report_id}`}
                    className={`cursor-pointer ${selected?.report_id === row.report_id && selected?.report_type === row.report_type ? 'bg-violet-50' : ''}`}
                    onClick={() => setSelected(row)}
                  >
                    <DataTableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite ? (
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(rowKey(row))}
                          onChange={() => {
                            const key = rowKey(row)
                            setSelectedKeys((prev) => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key)
                              else next.add(key)
                              return next
                            })
                          }}
                          aria-label="Select report"
                        />
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>
                      <p className="text-xs font-bold text-gray-900">{TYPE_LABELS[row.report_type] ?? row.report_type}</p>
                      {row.report_subtype && (row.report_type === 'comment' || row.report_type === 'policy') ? (
                        <p className="text-[10px] text-gray-500 capitalize">{row.report_subtype}</p>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>
                      <p className="text-xs font-medium text-gray-900 truncate max-w-[220px]">
                        {row.context_title || row.report_reason || '—'}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono truncate max-w-[220px]">
                        @{row.subject_slug || 'unknown'}
                      </p>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge label={row.report_status.toUpperCase()} tone={statusTone(row.report_status)} />
                    </DataTableCell>
                    <DataTableCell>
                      <p className="text-xs font-mono text-gray-800">{Number(row.age_hours ?? 0).toFixed(1)}h</p>
                      {row.sla_breached ? (
                        <p className="text-[10px] font-bold text-red-600">SLA breach</p>
                      ) : (
                        <p className="text-[10px] text-gray-400">target {slaTarget}h</p>
                      )}
                    </DataTableCell>
                    <DataTableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite ? (
                        <AssigneeChip
                          assignment={assignments.map[row.report_id]}
                          me={assignments.me}
                          busy={assignments.busyId === row.report_id}
                          onClaim={() => void assignments.claim(row.report_id)}
                          onRelease={() => void assignments.release(row.report_id)}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          {assignments.map[row.report_id]?.assignee_label || '—'}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <Link
                        href={deskHref(row)}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <div className="xl:col-span-1">
          {selected ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 sticky top-6">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400">Report detail</p>
                <p className="text-sm font-black text-gray-900 mt-1">
                  {TYPE_LABELS[selected.report_type]} · {selected.report_status}
                </p>
                <p className="text-[10px] font-mono text-gray-500 mt-1 break-all">{selected.report_id}</p>
              </div>

              <DetailRow label="Reason" value={selected.report_reason || '—'} />
              {selected.report_details ? <DetailRow label="Details" value={selected.report_details} /> : null}
              <DetailRow
                label="Filed"
                value={selected.report_created_at ? new Date(selected.report_created_at).toLocaleString() : '—'}
              />
              <DetailRow
                label="Reporter"
                value={
                  selected.report_type === 'policy'
                    ? 'system (ML)'
                    : `@${selected.reporter_slug || selected.reporter_id?.slice(0, 8) || '—'}`
                }
              />
              <DetailRow label="Subject" value={`@${selected.subject_slug || '—'}`} />
              {selected.report_type === 'policy' && selected.report_subtype ? (
                <DetailRow label="Surface" value={selected.report_subtype} />
              ) : null}
              {selected.moderation_state ? <DetailRow label="Moderation" value={selected.moderation_state} /> : null}

              {selected.report_type === 'policy' &&
              (selected.report_status === 'open' || selected.report_status === 'reviewing') ? (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase text-gray-400">ML review outcome</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Content stayed live (#61 fail-open). Mark whether the model was right, then take desk action if needed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={resolving}
                      onClick={() => void resolvePolicyFlag('true_positive')}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      True positive
                    </button>
                    <button
                      type="button"
                      disabled={resolving}
                      onClick={() => void resolvePolicyFlag('false_positive')}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      False positive
                    </button>
                    <button
                      type="button"
                      disabled={resolving}
                      onClick={() => void resolvePolicyFlag('inconclusive')}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Inconclusive
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href={deskHref(selected)}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
                >
                  Open surface desk
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                {selected.subject_user_id ? (
                  <Link
                    href={`/dashboard/users?q=${encodeURIComponent(selected.subject_user_id)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    User dossier
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Select a report to preview details and jump to the right desk.
            </div>
          )}

          {payload?.config?.notes ? (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-900 leading-relaxed">{payload.config.notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      <ActionReasonModal
        open={bulkDismissOpen}
        title="Bulk dismiss reports"
        description={`Dismiss ${selectedKeys.size} selected report(s). Content itself is not removed — only the report is closed.`}
        impactSummary="Each dismiss is audited. Use surface desks for hide/remove of the underlying post."
        categoryOptions={[
          { value: 'no_violation', label: 'No policy violation' },
          { value: 'duplicate', label: 'Duplicate / already handled' },
          { value: 'spam_report', label: 'Spam report' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={bulkBusy}
        onClose={() => setBulkDismissOpen(false)}
        onSubmit={runBulkDismiss}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string
  hint?: string
  alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-900">{value}</p>
      {hint ? <p className="text-[10px] text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
      <p className="text-xs text-gray-800 mt-0.5 whitespace-pre-wrap break-words">{value}</p>
    </div>
  )
}
