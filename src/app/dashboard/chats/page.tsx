'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Package,
  RefreshCcw,
  Search,
  UserRound,
} from 'lucide-react'

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
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseLookup(raw: string): {
  chatId?: string
  userId?: string
  q?: string
} {
  const t = raw.trim()
  if (!t) return {}
  if (UUID_RE.test(t)) {
    // Prefer chat id; API/RPC also matches user on chat id miss via separate call strategy in UI
    return { chatId: t, userId: t }
  }
  return { q: t }
}

export default function P2PChatViewerPage() {
  const searchParams = useSearchParams()
  const { countryCode } = useCountryFilter()
  const initialUserId = searchParams.get('userId') || ''
  const initialPartnerId = searchParams.get('partnerId') || ''
  const initialChatId = searchParams.get('chatId') || ''

  const [activeTab, setActiveTab] = useState<'recent' | 'lookup'>(
    initialUserId || initialPartnerId || initialChatId ? 'lookup' : 'recent',
  )
  const [lookup, setLookup] = useState(
    initialChatId || initialUserId || '',
  )
  const [partnerId, setPartnerId] = useState(initialPartnerId)
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initialPartnerId))
  const [rows, setRows] = useState<P2PChatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [listMode, setListMode] = useState<'browse' | 'search'>('browse')

  const selectedRow = useMemo(
    () => rows.find((row) => row.chat_id === selectedChatId) ?? null,
    [rows, selectedChatId],
  )

  const countryParam =
    countryCode === ALL_COUNTRIES_CODE ? null : countryCode

  const fetchChats = useCallback(
    async (opts: {
      mode: 'browse' | 'search'
      chatId?: string | null
      userId?: string | null
      partnerId?: string | null
      q?: string | null
    }): Promise<{ ok: boolean; rows: P2PChatRow[] }> => {
      setLoading(true)
      setFeedback(null)

      const params = new URLSearchParams({ limit: '80', offset: '0' })
      if (countryParam) params.set('countryCode', countryParam)
      if (opts.chatId) params.set('chatId', opts.chatId)
      if (opts.userId) params.set('userId', opts.userId)
      if (opts.partnerId) params.set('partnerId', opts.partnerId)
      if (opts.q) params.set('q', opts.q)

      const response = await fetch(`/api/admin/chats/search?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Could not load chats.')
        setFeedback({ tone: 'error', message: msg })
        setRows([])
        setSelectedChatId(null)
        setLoading(false)
        return { ok: false, rows: [] }
      }

      const payload = (await response.json().catch(() => ({}))) as {
        rows?: P2PChatRow[]
        mode?: 'browse' | 'search'
      }
      const nextRows = Array.isArray(payload.rows) ? payload.rows : []
      setRows(nextRows)
      setListMode(payload.mode === 'search' ? 'search' : opts.mode)
      setSelectedChatId((prev) => {
        if (prev && nextRows.some((row) => row.chat_id === prev)) return prev
        return nextRows[0]?.chat_id ?? null
      })
      setLoading(false)
      return { ok: true, rows: nextRows }
    },
    [countryParam],
  )

  const loadRecent = useCallback(async () => {
    const result = await fetchChats({
      mode: 'browse',
      partnerId: partnerId.trim() || null,
    })
    if (!result.ok) return
    if (result.rows.length === 0) {
      setFeedback({
        tone: 'info',
        message:
          'No threads for this country filter. Nigeria should show threads where buyer or seller has NG — try Lookup with thefirstshopper if still empty.',
      })
      return
    }
    setFeedback({
      tone: 'info',
      message: `Showing ${result.rows.length} recent thread${result.rows.length === 1 ? '' : 's'}. Browse is audit-logged.`,
    })
  }, [fetchChats, partnerId])

  const runLookup = useCallback(async () => {
    const parsed = parseLookup(lookup)
    const trimmedPartner = partnerId.trim() || null

    if (!parsed.chatId && !parsed.userId && !parsed.q && !trimmedPartner) {
      setFeedback({
        tone: 'error',
        message: 'Enter a chat UUID, user UUID, or profile slug / name / email.',
      })
      return
    }

    // UUID: try as chat id first; if empty, retry as user id.
    if (parsed.chatId && parsed.userId && parsed.chatId === parsed.userId) {
      let result = await fetchChats({
        mode: 'search',
        chatId: parsed.chatId,
        partnerId: trimmedPartner,
      })
      if (!result.ok) return
      if (result.rows.length === 0) {
        result = await fetchChats({
          mode: 'search',
          userId: parsed.userId,
          partnerId: trimmedPartner,
        })
        if (!result.ok) return
      }
      setFeedback({
        tone: 'info',
        message: `Found ${result.rows.length} chat thread${result.rows.length === 1 ? '' : 's'}. Lookup is audit-logged.`,
      })
      return
    }

    const result = await fetchChats({
      mode: 'search',
      chatId: parsed.chatId || null,
      userId: parsed.userId || null,
      q: parsed.q || null,
      partnerId: trimmedPartner,
    })
    if (!result.ok) return
    setFeedback({
      tone: 'info',
      message: `Found ${result.rows.length} chat thread${result.rows.length === 1 ? '' : 's'}. Lookup is audit-logged.`,
    })
  }, [fetchChats, lookup, partnerId])

  useEffect(() => {
    if (activeTab === 'recent') {
      void loadRecent()
    }
  }, [activeTab, countryCode]) // eslint-disable-line react-hooks/exhaustive-deps -- reload on country/tab

  useEffect(() => {
    if (initialUserId || initialPartnerId || initialChatId) {
      setActiveTab('lookup')
      void runLookup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="P2P Chat Viewer"
        subtitle="Read-only buyer–seller threads for trust & safety. Recent list is country-scoped; every browse, search, and transcript load is audit-logged."
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

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('recent')
            setSelectedChatId(null)
          }}
          className={`px-4 py-2 text-sm font-bold ${
            activeTab === 'recent' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          Recent threads
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lookup')}
          className={`px-4 py-2 text-sm font-bold ${
            activeTab === 'lookup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          Lookup
        </button>
      </div>

      {activeTab === 'recent' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRecent()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            {showAdvanced ? 'Hide advanced filter' : 'Partner filter'}
          </button>
          {showAdvanced ? (
            <input
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="Partner user UUID (optional)"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-mono w-72"
            />
          ) : null}
          <span className="text-xs text-gray-500 ml-auto">
            {rows.length} thread{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {activeTab === 'lookup' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <form
              className="flex gap-2 flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                void runLookup()
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  placeholder="Chat UUID, user UUID, slug, name, or email…"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lookup
              </button>
            </form>
            {rows.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('recent')
                  setSelectedChatId(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to recent
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            {showAdvanced ? 'Hide advanced filter' : 'Partner filter (optional)'}
          </button>
          {showAdvanced ? (
            <input
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="Other participant UUID"
              className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading threads…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title={listMode === 'browse' ? 'No recent chats' : 'No matching chats'}
              message={
                listMode === 'browse'
                  ? 'No recent P2P threads for this country filter yet.'
                  : 'No threads match that lookup. Try another UUID, slug, or name.'
              }
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
                      className={
                        isSelected
                          ? 'bg-blue-50/70 cursor-pointer'
                          : 'cursor-pointer hover:bg-blue-50/40'
                      }
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
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold uppercase text-gray-700">
                            {row.message_count} msgs
                          </span>
                          {row.has_active_commerce ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold uppercase text-amber-800">
                              Active commerce
                            </span>
                          ) : null}
                          <p className="font-mono text-gray-400 w-full">{row.chat_id.slice(0, 8)}…</p>
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
            <h2 className="text-sm font-bold text-gray-900">Case</h2>
            {selectedRow ? (
              <button
                type="button"
                onClick={() =>
                  activeTab === 'recent' ? void loadRecent() : void runLookup()
                }
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh list
              </button>
            ) : null}
          </div>

          {selectedRow ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase text-gray-700">
                    {selectedRow.chat_status || 'active'}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                    {selectedRow.message_count} messages
                  </span>
                  {selectedRow.has_active_commerce ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                      <Package size={11} /> Active order/booking
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <PartyLink
                    role="Buyer"
                    id={selectedRow.buyer_id}
                    name={selectedRow.buyer_display_name}
                    slug={selectedRow.buyer_slug}
                  />
                  <PartyLink
                    role="Seller"
                    id={selectedRow.seller_id}
                    name={selectedRow.seller_display_name}
                    slug={selectedRow.seller_slug}
                  />
                </div>
                <p className="text-[11px] font-mono text-gray-400 break-all">
                  chat {selectedRow.chat_id}
                </p>
              </div>

              <ChatCommerceLinksPanel
                key={`commerce-${selectedRow.chat_id}`}
                chatId={selectedRow.chat_id}
                includePairHistory
                compact
              />
              <DisputeChatTranscriptPanel
                key={selectedRow.chat_id}
                title="P2P chat transcript"
                description="Read-only thread. Load messages only when investigating this case — each load is written to the audit log."
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
              Select a chat from the list to open the case panel and load its transcript.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PartyLink({
  role,
  id,
  name,
  slug,
}: {
  role: string
  id: string | null
  name: string | null
  slug: string | null
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <UserRound className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{role}</p>
        <p className="font-semibold text-gray-900 truncate">{name || '—'}</p>
        <p className="text-xs text-gray-500">@{slug || '—'}</p>
        {id ? (
          <Link
            href={`/dashboard/users?q=${encodeURIComponent(id)}`}
            className="text-[11px] font-bold text-blue-600 hover:underline"
          >
            Open dossier →
          </Link>
        ) : null}
      </div>
    </div>
  )
}
