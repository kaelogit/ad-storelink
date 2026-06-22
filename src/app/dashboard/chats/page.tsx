'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, MessageCircle, RefreshCcw, Search, UserRound } from 'lucide-react'

import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { DisputeChatTranscriptPanel } from '../../../components/admin/DisputeChatTranscriptPanel'
import { ChatCommerceLinksPanel } from '../../../components/admin/ChatCommerceLinksPanel'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'

type P2PChatRow = {
  chat_id: string
  buyer_id: string | null
  seller_id: string | null
  buyer_slug: string | null
  seller_slug: string | null
  buyer_display_name: string | null
  seller_display_name: string | null
  last_message: string | null
  chat_status: string | null
  updated_at: string | null
  message_count: number
  has_active_commerce: boolean
}

export default function P2PChatViewerPage() {
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('userId') || ''
  const initialPartnerId = searchParams.get('partnerId') || ''
  const initialChatId = searchParams.get('chatId') || ''

  const [userId, setUserId] = useState(initialUserId)
  const [partnerId, setPartnerId] = useState(initialPartnerId)
  const [chatId, setChatId] = useState(initialChatId)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<P2PChatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const selectedRow = useMemo(
    () => rows.find((row) => row.chat_id === selectedChatId) ?? null,
    [rows, selectedChatId],
  )

  const runSearch = useCallback(async () => {
    const trimmedUserId = userId.trim()
    const trimmedChatId = chatId.trim()
    const trimmedQ = q.trim()

    if (!trimmedUserId && !trimmedChatId && !trimmedQ) {
      setFeedback({ tone: 'error', message: 'Enter a user id, chat id, or profile search query.' })
      return
    }

    setLoading(true)
    setFeedback(null)

    const params = new URLSearchParams({ limit: '80', offset: '0' })
    if (trimmedUserId) params.set('userId', trimmedUserId)
    if (partnerId.trim()) params.set('partnerId', partnerId.trim())
    if (trimmedChatId) params.set('chatId', trimmedChatId)
    if (trimmedQ) params.set('q', trimmedQ)

    const response = await fetch(`/api/admin/chats/search?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Could not search chats.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setSelectedChatId(null)
      setLoading(false)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as { rows?: P2PChatRow[] }
    const nextRows = Array.isArray(payload.rows) ? payload.rows : []
    setRows(nextRows)
    setSelectedChatId((prev) => {
      if (prev && nextRows.some((row) => row.chat_id === prev)) return prev
      return nextRows[0]?.chat_id ?? null
    })
    setFeedback({
      tone: 'info',
      message: `Found ${nextRows.length} chat thread${nextRows.length === 1 ? '' : 's'}. Search is audit-logged.`,
    })
    setLoading(false)
  }, [chatId, partnerId, q, userId])

  useEffect(() => {
    if (initialUserId || initialPartnerId || initialChatId) {
      void runSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="P2P Chat Viewer"
        subtitle="Read-only access to buyer–seller chat threads for trust & safety. Every search and transcript load is audit-logged."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/orders', label: 'Transaction Ops' },
              { href: '/dashboard/bookings', label: 'Bookings' },
              { href: '/dashboard/content-reports', label: 'Report inbox' },
              { href: '/dashboard/users', label: 'Users' },
            ]}
          />
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Search className="h-4 w-4 text-blue-600" />
          Find conversations
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">User id</span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID of either participant"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Partner id (optional)</span>
            <input
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="Other participant UUID"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Chat id</span>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Direct chat UUID"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Profile search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Slug, name, or email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search chats
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Searching…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No chats yet"
              message="Search by user id, chat id, or profile slug/name to list matching threads."
            />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Participants</DataTableHead>
                  <DataTableHead>Last message</DataTableHead>
                  <DataTableHead>Updated</DataTableHead>
                  <DataTableHead>Meta</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {rows.map((row) => {
                  const isSelected = row.chat_id === selectedChatId
                  return (
                    <DataTableRow
                      key={row.chat_id}
                      className={isSelected ? 'bg-blue-50/70 cursor-pointer' : 'cursor-pointer hover:bg-gray-50/80'}
                      onClick={() => setSelectedChatId(row.chat_id)}
                    >
                      <DataTableCell>
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-gray-900">
                            @{row.buyer_slug || 'buyer'} ↔ @{row.seller_slug || 'seller'}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {row.buyer_display_name || 'Buyer'} · {row.seller_display_name || 'Seller'}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {row.buyer_id ? (
                              <Link
                                href={`/dashboard/users?q=${row.buyer_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <UserRound className="h-3 w-3" /> Buyer dossier
                              </Link>
                            ) : null}
                            {row.seller_id ? (
                              <Link
                                href={`/dashboard/users?q=${row.seller_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <UserRound className="h-3 w-3" /> Seller dossier
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <p className="line-clamp-2 text-xs text-gray-700">{row.last_message || '—'}</p>
                      </DataTableCell>
                      <DataTableCell>
                        <p className="text-xs text-gray-600">
                          {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                        </p>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="space-y-1 text-[10px]">
                          <span className="rounded-full bg-gray-100 px-2 py-1 font-bold uppercase text-gray-700">
                            {row.message_count} msgs
                          </span>
                          {row.has_active_commerce ? (
                            <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 font-bold uppercase text-amber-800">
                              Active order/booking
                            </span>
                          ) : null}
                          <p className="font-mono text-gray-400 break-all">{row.chat_id.slice(0, 8)}…</p>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Transcript</h2>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh list
            </button>
          </div>

          {selectedRow ? (
            <>
              <ChatCommerceLinksPanel
                key={`commerce-${selectedRow.chat_id}`}
                chatId={selectedRow.chat_id}
                includePairHistory
                compact
              />
              <DisputeChatTranscriptPanel
              key={selectedRow.chat_id}
              title="P2P chat transcript"
              description="Read-only thread between buyer and seller. Load messages only when investigating this case — each load is written to the audit log."
              conversationId={selectedRow.chat_id}
              entityId={selectedRow.chat_id}
              endpoint="/api/admin/chats/transcript"
              requestBody={{ chatId: selectedRow.chat_id }}
              onLoaded={(count) =>
                setFeedback({
                  tone: 'info',
                  message: `Loaded ${count} message(s) for chat ${selectedRow.chat_id.slice(0, 8)}… View is audit-logged.`,
                })
              }
            />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Select a chat from the list to load its transcript.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
