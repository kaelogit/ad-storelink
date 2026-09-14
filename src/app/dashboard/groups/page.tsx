'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCcw, Search } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import type { AdminGroupChatRow } from '../../api/admin/groups/list/route'

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `gk-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function AdminGroupsDeskPage() {
  const searchParams = useSearchParams()
  const initialGroupId = searchParams.get('groupId') || ''
  const initialHostId = searchParams.get('hostId') || ''
  const initialQ = searchParams.get('q') || initialGroupId

  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('all')
  const [hostId, setHostId] = useState(initialHostId)
  const [rows, setRows] = useState<AdminGroupChatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialGroupId || null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const selected = useMemo(
    () => rows.find((row) => row.group_id === selectedId) ?? null,
    [rows, selectedId],
  )

  const runSearch = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    const params = new URLSearchParams({ limit: '80', offset: '0' })
    if (q.trim()) params.set('q', q.trim())
    if (status !== 'all') params.set('status', status)
    if (hostId.trim()) params.set('hostId', hostId.trim())

    const response = await fetch(`/api/admin/groups/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Could not load groups.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setSelectedId(null)
      setLoading(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { rows?: AdminGroupChatRow[] }
    const nextRows = Array.isArray(payload.rows) ? payload.rows : []
    setRows(nextRows)
    setSelectedId((prev) => {
      if (prev && nextRows.some((row) => row.group_id === prev)) return prev
      return nextRows[0]?.group_id ?? null
    })
    setFeedback({
      tone: 'info',
      message: `Found ${nextRows.length} communit${nextRows.length === 1 ? 'y' : 'ies'}.`,
    })
    setLoading(false)
  }, [hostId, q, status])

  useEffect(() => {
    void runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const forceArchive = async () => {
    if (!selected) return
    if (selected.status === 'archived') {
      setFeedback({ tone: 'info', message: 'Already archived.' })
      return
    }
    if (reason.trim().length < 8) {
      setFeedback({ tone: 'error', message: 'Enter a reason (min 8 characters) before archiving.' })
      return
    }
    setBusy(true)
    const response = await fetch('/api/admin/groups/archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': newIdempotencyKey(),
      },
      body: JSON.stringify({ groupId: selected.group_id, reason: reason.trim() }),
    })
    setBusy(false)
    if (!response.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(response, 'Archive failed.') })
      return
    }
    setFeedback({ tone: 'success', message: 'Community force-archived.' })
    setReason('')
    await runSearch()
  }

  const toggleCreateBan = async (banned: boolean) => {
    if (!selected) return
    if (banned && reason.trim().length < 8) {
      setFeedback({ tone: 'error', message: 'Enter a reason (min 8 characters) before banning create.' })
      return
    }
    setBusy(true)
    const response = await fetch('/api/admin/groups/ban-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': newIdempotencyKey(),
      },
      body: JSON.stringify({
        userId: selected.host_seller_id,
        banned,
        reason: reason.trim() || undefined,
      }),
    })
    setBusy(false)
    if (!response.ok) {
      setFeedback({
        tone: 'error',
        message: await parseApiError(response, banned ? 'Ban failed.' : 'Unban failed.'),
      })
      return
    }
    setFeedback({
      tone: 'success',
      message: banned ? 'Host banned from creating communities.' : 'Create ban lifted.',
    })
    setReason('')
    await runSearch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communities"
        subtitle="List seller communities, force-archive, and ban hosts from creating new groups."
      />

      <DeskLinkPills
        links={[
          { href: '/dashboard/content-reports', label: 'Report Inbox' },
          { href: '/dashboard/chats', label: 'P2P Chats' },
          { href: '/dashboard/users', label: 'Users' },
          { href: '/dashboard/audit', label: 'Audit Log' },
        ]}
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-slate-500">Search title / host / id</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="VIP Drops, @slug, uuid…"
              />
            </div>
          </label>
          <label className="text-sm md:w-40">
            <span className="mb-1 block text-slate-500">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'archived')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-sm md:w-64">
            <span className="mb-1 block text-slate-500">Host user id</span>
            <input
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="optional uuid"
            />
          </label>
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {rows.length === 0 && !loading ? (
            <EmptyState title="No communities" message="Try a broader search or clear filters." />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Community</DataTableHead>
                  <DataTableHead>Host</DataTableHead>
                  <DataTableHead>Members</DataTableHead>
                  <DataTableHead>Reports</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.group_id}
                    className={selectedId === row.group_id ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'cursor-pointer'}
                    onClick={() => setSelectedId(row.group_id)}
                  >
                    <DataTableCell>
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.join_policy}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{row.host_display_name || row.host_slug || '—'}</div>
                      <div className="text-xs text-slate-500">@{row.host_slug || '—'}</div>
                    </DataTableCell>
                    <DataTableCell>
                      {row.member_count}/{row.member_cap}
                    </DataTableCell>
                    <DataTableCell>{row.open_report_count}</DataTableCell>
                    <DataTableCell>
                      <span
                        className={
                          row.status === 'active'
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700'
                        }
                      >
                        {row.status}
                      </span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {!selected ? (
            <EmptyState title="Select a community" message="Choose a row to archive or ban the host." />
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="text-sm text-slate-500 break-all">{selected.group_id}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Members</dt>
                  <dd className="font-medium">
                    {selected.member_count}/{selected.member_cap}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Open reports</dt>
                  <dd className="font-medium">{selected.open_report_count}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Host</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/dashboard/users?userId=${selected.host_seller_id}`}
                      className="text-emerald-700 underline dark:text-emerald-400"
                    >
                      {selected.host_display_name || selected.host_slug || selected.host_seller_id}
                    </Link>
                    {selected.host_groups_create_banned ? (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        create banned
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Moderation reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Required for archive / ban (min 8 chars)"
                />
              </label>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || selected.status === 'archived'}
                  onClick={() => void forceArchive()}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Force archive
                </button>
                {selected.host_groups_create_banned ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleCreateBan(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700"
                  >
                    Lift create ban
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleCreateBan(true)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    Ban host from creating communities
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
