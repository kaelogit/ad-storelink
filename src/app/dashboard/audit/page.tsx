'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { Button, Card, CardHeader, CardContent, Input, Badge } from '../../../components/ui'
import { DataTable, DataTableHeader, DataTableBody, DataTableRow, DataTableHead, DataTableCell } from '../../../components/ui'
import { Search, Download, Loader2 } from 'lucide-react'
import type { AdminAuditLog } from '../../../types/admin'

const ACTION_TYPES = [
  'SYSTEM_CONFIG_CHANGE',
  'USER_STATUS_CHANGE',
  'KYC_VERIFICATION',
  'ORDER_INTERVENTION',
  'DISPUTE_VERDICT',
  'PAYOUT_APPROVE',
  'PAYOUT_REJECT',
  'SUPPORT_REPLY',
  'SUPPORT_RESOLVE',
  'BROADCAST_SEND',
  'BANNER_CREATE',
  'BANNER_DELETE',
  'STAFF_INVITE',
  'STAFF_STATUS_CHANGE',
]

export default function AuditLogPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo) q = q.lte('created_at', dateTo)
    if (actionFilter) q = q.eq('action_type', actionFilter)
    const { data } = await q
    setLogs((data as AdminAuditLog[]) ?? [])
    setLoading(false)
  }, [dateFrom, dateTo, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter(
    (l) =>
      !appliedSearch ||
      l.admin_email?.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      l.action_type?.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      (l.details ?? '').toLowerCase().includes(appliedSearch.toLowerCase()) ||
      (l.target_id ?? '').toLowerCase().includes(appliedSearch.toLowerCase())
  )

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (actionFilter) params.set('action_type', actionFilter)
      const res = await fetch(`/api/admin/audit/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${dateFrom || 'all'}-${dateTo || 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="All admin actions are recorded here. Filter and export for compliance."
        actions={
          <Button variant="secondary" size="md" onClick={handleExport} loading={exporting} disabled={exporting}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
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
              {ACTION_TYPES.map((t) => (
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
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setActionFilter(''); setAppliedSearch(''); setSearch(''); fetchLogs(); }}>
              Clear
            </Button>
          </div>
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
                {filteredLogs.map((log) => (
                  <DataTableRow key={log.id}>
                    <DataTableCell className="whitespace-nowrap text-xs text-[var(--muted)]">
                      {new Date(log.created_at).toLocaleString()}
                    </DataTableCell>
                    <DataTableCell className="font-medium">{log.admin_email ?? '—'}</DataTableCell>
                    <DataTableCell>
                      <Badge tone="neutral">{log.action_type}</Badge>
                    </DataTableCell>
                    <DataTableCell className="text-xs text-[var(--muted)]">{log.target_id ?? '—'}</DataTableCell>
                    <DataTableCell className="max-w-md truncate text-xs">{log.details ?? '—'}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
          {!loading && filteredLogs.length === 0 && (
            <div className="py-12 text-center text-[var(--muted)]">
              {logs.length === 0 ? 'No audit logs in this range.' : 'No logs match your search.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
