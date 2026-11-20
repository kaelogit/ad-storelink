'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { EmptyState } from '../../../components/admin/EmptyState'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { parseApiError } from '../../../utils/http'
import { Button, Card, CardHeader, CardContent, Input } from '../../../components/ui'
import { DataTable, DataTableHeader, DataTableBody, DataTableRow, DataTableHead, DataTableCell } from '../../../components/ui'
import { Search, Download, Loader2 } from 'lucide-react'
import type { AdminAuditLog } from '../../../types/admin'

const KNOWN_ACTION_TYPES = [
  'SYSTEM_CONFIG_CHANGE',
  'USER_STATUS_CHANGE',
  'KYC_VERIFICATION',
  'BUSINESS_KYC_VERIFICATION',
  'ORDER_INTERVENTION',
  'SERVICE_ORDER_INTERVENTION',
  'BOOKING_FORCE_STATUS_API',
  'DISPUTE_VERDICT',
  'PAYOUT_APPROVE',
  'PAYOUT_REJECT',
  'SUPPORT_REPLY',
  'SUPPORT_RESOLVE',
  'SUPPORT_TICKET_RESOLVED',
  'BROADCAST_SEND',
  'BROADCAST_SENT',
  'BANNER_CREATE',
  'BANNER_DELETE',
  'STAFF_INVITE',
  'STAFF_STATUS_CHANGE',
  'RANKING_FLAG_CHANGE',
  'RANKING_EXPERIMENT_CHANGE',
  'RANKING_KILL_SWITCH',
  'FEATURE_FLAG_CHANGE',
  'LEGAL_POLICY_PUBLISH',
  'PRODUCT_MODERATION',
  'SPOTLIGHT_MODERATION',
  'SAFETY_TESTS_RUN',
  'SEARCH_EMBEDDINGS_RUN',
  'PAYMENT_INCIDENT_DESK_VIEW',
  'ANALYTICS_WAREHOUSE_VIEW',
  'ADS_WAREHOUSE_VIEW',
  'CONTENT_REPORTS_INBOX_VIEW',
  'LISTING_CONTENT_INTEGRITY_VIEW',
  'CHAT_COMMERCE_LINKS_VIEW',
  'DISPUTE_BOOKING_CHAT_VIEW',
  'P2P_CHAT_BROWSE',
  'P2P_CHAT_SEARCH',
  'P2P_CHAT_TRANSCRIPT_VIEW',
  'GROUP_CHATS_DESK_VIEW',
]

function isViewOnlyAction(actionType: string | null | undefined): boolean {
  if (!actionType) return false
  return (
    actionType.endsWith('_VIEW') ||
    actionType.endsWith('_BROWSE') ||
    actionType === 'P2P_CHAT_SEARCH'
  )
}

function detailsSummary(details: unknown): string {
  if (details == null) return '-'
  if (typeof details === 'string') return details
  if (typeof details === 'object' && details !== null) {
    const d = details as Record<string, unknown>
    if (typeof d.message === 'string' && d.message.trim()) return d.message
    if (typeof d.reason === 'string' && d.reason.trim()) return d.reason
  }
  try {
    return JSON.stringify(details)
  } catch {
    return String(details)
  }
}

export default function AuditLogPage() {
  const supabase = useMemo(() => createClient(), [])
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [mutationsOnly, setMutationsOnly] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    try {
      let q = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`)
      if (actionFilter) q = q.eq('action_type', actionFilter)
      const { data, error } = await q
      if (error) {
        setFeedback({ tone: 'error', message: error.message || 'Failed to load audit logs.' })
        setLogs([])
        return
      }
      setLogs((data as AdminAuditLog[]) ?? [])
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to load audit logs.',
      })
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supabase, dateFrom, dateTo, actionFilter])

  const detailsToText = (details: unknown): string => {
    if (details == null) return ''
    if (typeof details === 'string') return details
    try {
      return JSON.stringify(details)
    } catch {
      return String(details)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const actionTypeOptions = useMemo(() => {
    const fromLogs = logs.map((l) => l.action_type).filter(Boolean) as string[]
    return Array.from(new Set([...KNOWN_ACTION_TYPES, ...fromLogs])).sort()
  }, [logs])

  const filteredLogs = logs.filter((l) => {
    if (mutationsOnly && isViewOnlyAction(l.action_type)) return false
    if (!appliedSearch) return true
    const q = appliedSearch.toLowerCase()
    return (
      l.admin_email?.toLowerCase().includes(q) ||
      l.action_type?.toLowerCase().includes(q) ||
      detailsToText(l.details).toLowerCase().includes(q) ||
      (l.target_id ?? '').toLowerCase().includes(q)
    )
  })

  const handleExport = async () => {
    setExporting(true)
    setFeedback(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (actionFilter) params.set('action_type', actionFilter)
      const res = await fetch(`/api/admin/audit/export?${params.toString()}`)
      if (!res.ok) throw new Error(await parseApiError(res, 'Export failed.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${dateFrom || 'all'}-${dateTo || 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setFeedback({ tone: 'success', message: 'Audit log export downloaded.' })
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Export failed.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Compliance trail for admin mutations. Desk page-views are hidden by default."
        actions={
          <Button variant="secondary" size="md" onClick={handleExport} loading={exporting} disabled={exporting}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <Input
                placeholder="Search by admin, action type, details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(search)}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setAppliedSearch(search)}>
              Apply
            </Button>
            <select
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All action types</option>
              {actionTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <label className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={mutationsOnly}
                onChange={(e) => setMutationsOnly(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              Mutations only
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setActionFilter('')
                setAppliedSearch('')
                setSearch('')
                setMutationsOnly(true)
                void fetchLogs()
              }}
            >
              Clear
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Showing {filteredLogs.length} of {logs.length} loaded
            {mutationsOnly ? ' (page views / browse hidden)' : ''}.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Timestamp</DataTableHead>
                  <DataTableHead>Admin</DataTableHead>
                  <DataTableHead>Action</DataTableHead>
                  <DataTableHead>Target</DataTableHead>
                  <DataTableHead>Details</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {filteredLogs.map((log) => {
                  const summary = detailsSummary(log.details)
                  const raw = detailsToText(log.details)
                  const expanded = expandedId === log.id
                  return (
                    <DataTableRow key={log.id}>
                      <DataTableCell className="whitespace-nowrap text-xs text-[var(--muted)]">
                        {new Date(log.created_at).toLocaleString()}
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {log.admin_email?.trim() ? log.admin_email : (
                          <span className="text-[var(--muted)]" title="Writer did not attach admin_email">
                            —
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          tone={isViewOnlyAction(log.action_type) ? 'neutral' : 'info'}
                          label={log.action_type}
                        />
                      </DataTableCell>
                      <DataTableCell className="max-w-[140px] truncate text-xs text-[var(--muted)] font-mono">
                        {log.target_id ?? '-'}
                      </DataTableCell>
                      <DataTableCell className="max-w-md text-xs">
                        <p className={expanded ? 'whitespace-pre-wrap break-all' : 'truncate'}>
                          {expanded ? raw || '-' : summary}
                        </p>
                        {raw && raw !== summary ? (
                          <button
                            type="button"
                            className="mt-1 text-[10px] font-semibold text-[var(--primary)]"
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                          >
                            {expanded ? 'Hide JSON' : 'Show JSON'}
                          </button>
                        ) : null}
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
          {!loading && filteredLogs.length === 0 && (
            <div className="p-4">
              <EmptyState
                title={logs.length === 0 ? 'No audit logs' : 'No matches'}
                message={
                  logs.length === 0
                    ? 'No audit logs in this range.'
                    : mutationsOnly
                      ? 'No mutation logs match. Turn off “Mutations only” to include desk views.'
                      : 'No logs match your search.'
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
