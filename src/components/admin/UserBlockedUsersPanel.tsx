'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2, ShieldBan, UserX } from 'lucide-react'
import { parseApiError } from '../../utils/http'

type BlockRow = {
  block_id: string
  direction: 'outgoing' | 'incoming'
  other_user_id: string
  other_slug: string | null
  other_display_name: string | null
  created_at: string | null
}

type Tab = 'outgoing' | 'incoming'

const PAGE_SIZE = 25

type UserBlockedUsersPanelProps = {
  userId: string
}

export function UserBlockedUsersPanel({ userId }: UserBlockedUsersPanelProps) {
  const [tab, setTab] = useState<Tab>('outgoing')
  const [outgoing, setOutgoing] = useState<BlockRow[]>([])
  const [incoming, setIncoming] = useState<BlockRow[]>([])
  const [outgoingOffset, setOutgoingOffset] = useState(0)
  const [incomingOffset, setIncomingOffset] = useState(0)
  const [outgoingHasMore, setOutgoingHasMore] = useState(false)
  const [incomingHasMore, setIncomingHasMore] = useState(false)
  const [outgoingLoaded, setOutgoingLoaded] = useState(false)
  const [incomingLoaded, setIncomingLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDirection = useCallback(
    async (direction: Tab, reset = false) => {
      setLoading(true)
      setError(null)
      const offset = reset ? 0 : direction === 'outgoing' ? outgoingOffset : incomingOffset
      const params = new URLSearchParams({
        userId,
        direction,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const response = await fetch(`/api/admin/users/blocks?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Could not load block list.')
        setError(msg)
        setLoading(false)
        return
      }
      const payload = (await response.json().catch(() => ({}))) as { rows?: BlockRow[] }
      const rows = Array.isArray(payload.rows) ? payload.rows : []

      if (direction === 'outgoing') {
        setOutgoing((prev) => (reset ? rows : [...prev, ...rows]))
        setOutgoingOffset(offset + rows.length)
        setOutgoingHasMore(rows.length >= PAGE_SIZE)
        setOutgoingLoaded(true)
      } else {
        setIncoming((prev) => (reset ? rows : [...prev, ...rows]))
        setIncomingOffset(offset + rows.length)
        setIncomingHasMore(rows.length >= PAGE_SIZE)
        setIncomingLoaded(true)
      }
      setLoading(false)
    },
    [incomingOffset, outgoingOffset, userId],
  )

  const switchTab = (next: Tab) => {
    setTab(next)
    setError(null)
    if (next === 'outgoing' && !outgoingLoaded) void loadDirection('outgoing', true)
    if (next === 'incoming' && !incomingLoaded) void loadDirection('incoming', true)
  }

  const rows = tab === 'outgoing' ? outgoing : incoming
  const loaded = tab === 'outgoing' ? outgoingLoaded : incomingLoaded
  const hasMore = tab === 'outgoing' ? outgoingHasMore : incomingHasMore

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 via-white to-gray-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center">
            <ShieldBan size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Blocked users</p>
            <p className="text-sm font-black text-gray-900">Safety cross-view</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Read-only lists for harassment or safety investigations. Each page load is audit-logged.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabClass(tab === 'outgoing')} onClick={() => switchTab('outgoing')}>
            <span className="inline-flex items-center gap-1">
              <UserX size={12} /> Blocked by user
            </span>
          </button>
          <button type="button" className={tabClass(tab === 'incoming')} onClick={() => switchTab('incoming')}>
            <span className="inline-flex items-center gap-1">
              <ShieldBan size={12} /> Blocked this user
            </span>
          </button>
        </div>

        {!loaded ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadDirection(tab, true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Load {tab === 'outgoing' ? 'blocked accounts' : 'blockers'}
          </button>
        ) : null}

        {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

        {loaded && rows.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            {tab === 'outgoing' ? 'This user has not blocked anyone.' : 'No one has blocked this user.'}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={row.block_id} className="px-3 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-gray-900">
                    @{row.other_slug || row.other_user_id.slice(0, 8)}
                  </span>
                  {row.created_at ? (
                    <span className="text-[10px] text-gray-400">{new Date(row.created_at).toLocaleString()}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-600">{row.other_display_name || 'Unknown user'}</p>
                <Link
                  href={`/dashboard/users?q=${row.other_user_id}`}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                >
                  Open dossier
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {loaded && hasMore ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadDirection(tab, false)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
