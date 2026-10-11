'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { parseApiError } from '../../../utils/http'
import { ChatCommerceLinksPanel } from '../../../components/admin/ChatCommerceLinksPanel'
import { ServiceBookingTimelinePanel, type BookingTimelinePayload } from '../../../components/admin/ServiceBookingTimelinePanel'
import { formatServiceDisputeReason } from '../../../lib/serviceDisputeReasons'
import {
  Search,
  Calendar,
  Package,
  Loader2,
  RefreshCcw,
  XCircle,
  CheckCircle,
  AlertTriangle,
  MessageCircle,
  FileText,
  ImageIcon,
  Copy,
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Wallet,
} from 'lucide-react'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'
import { AdminAvatar } from '../../../components/admin/AdminAvatar'

type BookingDetail = {
  id: string
  status: string
  amount_minor: number
  currency_code: string
  service_menu_item: { name?: string; price_minor?: number } | null
  scheduled_at: string | null
  conversation_id: string | null
  is_custom_quote: boolean
  custom_description: string | null
  dispute_metadata: Record<string, unknown> | null
  dispute_state?: 'none' | 'under_review' | 'disputed' | 'refunded'
  dispute_reason?: string | null
  dispute_note?: string | null
  released_at_start: string | null
  released_at_complete: string | null
  created_at: string
  updated_at: string
  buyer: {
    id: string
    display_name: string
    email: string
    phone: string
    location_city: string
    location_state: string
    logo_url?: string | null
  }
  seller: {
    id: string
    display_name: string
    email: string
    phone: string
    location_city: string
    location_state: string
    logo_url?: string | null
  }
  listing: { id: string; title: string; service_category: string; hero_price_min: number; currency_code: string } | null
  escrow_breakdown: {
    amount_minor_total: number
    amount_minor_held: number
    amount_minor_released_start: number
    amount_minor_released_complete: number
  }
  booking_timeline?: BookingTimelinePayload | null
  linked_order_id: string | null
  linked_payment_reference?: string | null
  policy_url?: string
}

type BookingListRow = {
  id: string
  status: string
  amount_minor: number
  currency_code: string
  buyer_display_name: string
  seller_display_name: string
  listing_title: string | null
  created_at: string
  dispute_state?: 'none' | 'under_review' | 'disputed' | 'refunded'
  has_dispute?: boolean
  is_refunded?: boolean
  policy_url?: string
}

type DisputeChatMessageRow = {
  message_id: string
  conversation_id: string
  sender_id: string | null
  sender_display_name: string | null
  sender_role: string | null
  created_at: string | null
  text: string | null
  type: string | null
  image_url: string | null
  gif_url: string | null
  audio_url: string | null
  video_url: string | null
  document_url: string | null
  document_name: string | null
  reply_to_snippet: string | null
}

const TERMINAL = new Set(['completed', 'cancelled', 'refunded'])

function bookingIsPaidInFull(booking: BookingDetail): boolean {
  const paymentState = String(booking.booking_timeline?.payment_state || '').toLowerCase()
  if (paymentState === 'paid_in_full') return true
  const held = Number(booking.escrow_breakdown?.amount_minor_held ?? 0)
  const total = Number(booking.escrow_breakdown?.amount_minor_total ?? booking.amount_minor ?? 0)
  return total > 0 && held >= total
}

function bookingBlocksForceComplete(booking: BookingDetail): boolean {
  const deposit = Boolean(booking.booking_timeline?.deposit_enabled_snapshot)
  const paymentState = String(booking.booking_timeline?.payment_state || '').toLowerCase()
  if (deposit && paymentState !== 'paid_in_full') return true
  return !bookingIsPaidInFull(booking)
}

function fromSmallestUnit(amountMinor: number, currencyCode: string): number {
  const code = (currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return Number(amountMinor || 0) / Math.pow(10, decimals)
}

function formatMoney(amountMinor: number, currencyCode: string): string {
  const code = currencyCode || 'NGN'
  return `${code} ${fromSmallestUnit(amountMinor, code).toLocaleString()}`
}

function isActiveServiceDispute(b: BookingDetail): boolean {
  const st = String(b.status || '').toLowerCase()
  const ds = String(b.dispute_state || 'none').toLowerCase()
  return st === 'disputed' || ds === 'under_review' || ds === 'disputed'
}

function attachmentSummary(m: DisputeChatMessageRow): string | null {
  if (m.image_url) return 'Photo'
  if (m.gif_url) return 'GIF'
  if (m.video_url) return 'Video'
  if (m.audio_url) return 'Voice message'
  if (m.document_url) return m.document_name ? `File: ${m.document_name}` : 'File'
  return null
}

export default function BookingsPage() {
  const supabase = createClient()
  const { countryCode } = useCountryFilter()
  const [query, setQuery] = useState('')
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [list, setList] = useState<BookingListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'cancelled' | 'refunded' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'lookup' | 'list'>('list')
  const [listFilter, setListFilter] = useState<'all' | 'disputes'>('all')
  const [listStatusFilter, setListStatusFilter] = useState<
    'all' | 'requested' | 'confirmed' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'disputed' | 'refunded'
  >('all')
  const [listQuery, setListQuery] = useState('')
  const [lastRefundRef, setLastRefundRef] = useState<string | null>(null)
  const [disputeChatLoading, setDisputeChatLoading] = useState(false)
  const [disputeChatMessages, setDisputeChatMessages] = useState<DisputeChatMessageRow[]>([])
  const [disputeChatError, setDisputeChatError] = useState<string | null>(null)

  const enrichBookingLogos = async (detail: BookingDetail): Promise<BookingDetail> => {
    const ids = [detail.buyer?.id, detail.seller?.id].filter(Boolean) as string[]
    if (ids.length === 0) return detail
    const { data } = await supabase.from('profiles').select('id, logo_url').in('id', ids)
    const logos = Object.fromEntries((data ?? []).map((p) => [p.id, p.logo_url ?? null]))
    return {
      ...detail,
      buyer: detail.buyer
        ? { ...detail.buyer, logo_url: logos[detail.buyer.id] ?? detail.buyer.logo_url ?? null }
        : detail.buyer,
      seller: detail.seller
        ? { ...detail.seller, logo_url: logos[detail.seller.id] ?? detail.seller.logo_url ?? null }
        : detail.seller,
    }
  }

  const openBookingByQuery = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setLoading(true)
    setBooking(null)
    setActiveTab('lookup')
    setQuery(q)
    setLastRefundRef(null)
    setDisputeChatMessages([])
    setDisputeChatError(null)
    const { data, error } = await supabase.rpc('get_service_order_details_for_admin', {
      p_query: q,
    })
    if (error) {
      setFeedback({
        tone: 'error',
        message: error.message || 'Booking lookup failed. Apply migration 20261120820000 if phone column error.',
      })
    } else if (data) {
      setBooking(await enrichBookingLogos(data as BookingDetail))
    } else {
      setFeedback({
        tone: 'error',
        message: 'Booking not found. Try booking UUID, 8-char prefix, linked order UUID, or Paystack ref.',
      })
    }
    setLoading(false)
  }

  const searchBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    await openBookingByQuery(query)
  }

  const loadList = async () => {
    setListLoading(true)
    const pCountry = countryCode === ALL_COUNTRIES_CODE ? null : countryCode
    const pStatus = listStatusFilter === 'all' ? null : listStatusFilter
    const { data, error } = await supabase.rpc('get_admin_service_orders', {
      p_country_code: pCountry,
      p_status: pStatus,
      p_limit: 100,
      p_offset: 0,
    })
    if (!error && Array.isArray(data)) {
      setList(data as BookingListRow[])
    } else {
      setList([])
      if (error) setFeedback({ tone: 'error', message: error.message || 'Failed to load bookings.' })
    }
    setListLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'list') void loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when country/status filters change
  }, [activeTab, countryCode, listStatusFilter])

  const forceStatus = async ({
    status,
    reason,
    category,
  }: {
    status: 'completed' | 'cancelled' | 'refunded'
    reason: string
    category: string
  }) => {
    if (!booking?.id) return
    if (status === 'completed' && bookingBlocksForceComplete(booking)) {
      setFeedback({
        tone: 'error',
        message:
          'Cannot force-complete until this booking is paid in full (deposit balance still due or escrow underfunded).',
      })
      setPendingStatus(null)
      return
    }
    setActionLoading(true)
    setFeedback({ tone: 'info', message: `Applying ${status}...` })
    const response = await fetch('/api/admin/bookings/force-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `support-booking-force-status-${booking.id}-${status}`,
      },
      body: JSON.stringify({
        serviceOrderId: booking.id,
        newStatus: status,
        reasonCategory: category,
        reason,
      }),
    })
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to update booking status.')
      setFeedback({ tone: 'error', message: msg })
      setActionLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      refund?: { executed?: boolean; orderId?: string; paystackReference?: string | null }
      clawbackDebt?: { id?: string; amountMinor?: number; currencyCode?: string; sellerId?: string }
      mode?: string
    }
    const { data } = await supabase.rpc('get_service_order_details_for_admin', { p_query: booking.id })
    if (data) setBooking(await enrichBookingLogos(data as BookingDetail))
    setPendingStatus(null)
    const refundMsg =
      status === 'refunded'
        ? payload?.refund?.executed
          ? ` Refund executed for order ${payload.refund.orderId?.slice(0, 8) ?? 'linked order'}.`
          : ' Booking status changed but refund execution was not confirmed.'
        : ''
    const clawbackMsg =
      status === 'refunded' && payload?.clawbackDebt?.id
        ? ` Seller clawback debt opened: ${formatMoney(payload.clawbackDebt.amountMinor ?? 0, payload.clawbackDebt.currencyCode ?? booking.currency_code)}. Seller access is locked until repayment.`
        : ''
    if (status === 'refunded' && payload?.refund?.executed && payload.refund.paystackReference) {
      setLastRefundRef(payload.refund.paystackReference)
    } else if (status !== 'refunded') {
      setLastRefundRef(null)
    }
    setFeedback({ tone: 'success', message: `Booking status updated to ${status}.${refundMsg}${clawbackMsg}`.trim() })
    setActionLoading(false)
  }

  const loadDisputeChat = async () => {
    if (!booking?.id) return
    setDisputeChatLoading(true)
    setDisputeChatError(null)
    try {
      const res = await fetch('/api/admin/bookings/dispute-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceOrderId: booking.id }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        messages?: DisputeChatMessageRow[]
      }
      if (!res.ok) {
        setDisputeChatError(payload.error || 'Could not load chat.')
        setDisputeChatMessages([])
        return
      }
      setDisputeChatMessages(Array.isArray(payload.messages) ? payload.messages : [])
      setFeedback({
        tone: 'info',
        message: `Loaded ${payload.messages?.length ?? 0} message(s). View is audit-logged.`,
      })
    } catch {
      setDisputeChatError('Network error loading chat.')
      setDisputeChatMessages([])
    } finally {
      setDisputeChatLoading(false)
    }
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ tone: 'success', message: `${label} copied.` })
    } catch {
      setFeedback({ tone: 'error', message: `Could not copy ${label}.` })
    }
  }

  const canIntervene = booking && !TERMINAL.has(String(booking.status || '').toLowerCase())
  const status = String(booking?.status || '').toLowerCase()

  const baseList =
    listFilter === 'disputes'
      ? list.filter((row) => row.has_dispute || row.status === 'disputed' || row.status === 'refunded')
      : list

  const searchTerm = listQuery.trim().toLowerCase()
  const filteredList = searchTerm
    ? baseList.filter((row) => {
        const haystack = [row.id, row.buyer_display_name, row.seller_display_name, row.listing_title]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(searchTerm)
      })
    : baseList

  const prettyDisputeState = (state?: BookingDetail['dispute_state']) => {
    if (!state || state === 'none') return null
    if (state === 'under_review') return 'Under review'
    if (state === 'disputed') return 'In dispute'
    if (state === 'refunded') return 'Refunded after dispute'
    return state
  }
  const disputeReason = booking
    ? formatServiceDisputeReason(booking.dispute_reason) || getNoShowReasonFromMetadata(booking.dispute_metadata)
    : null
  const disputeNote = booking
    ? booking.dispute_note || getNoShowNoteFromMetadata(booking.dispute_metadata)
    : null

  const escrow = booking?.escrow_breakdown
  const payRef =
    booking?.linked_payment_reference ||
    booking?.booking_timeline?.linked_order?.payment_reference ||
    null

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Bookings"
        subtitle="Browse recent service bookings, click for full detail, or look up by booking UUID / linked order / Paystack ref."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/finance', label: 'Finance' },
              { href: '/dashboard/clawback-debts', label: 'Clawback' },
              { href: '/dashboard/payment-incidents', label: 'Payment incidents' },
              { href: '/dashboard/chats', label: 'P2P chats' },
            ]}
          />
        }
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('list')
            setBooking(null)
            void loadList()
          }}
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Recent bookings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lookup')}
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'lookup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Lookup
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadList()}
              disabled={listLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              {listLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <select
              value={listStatusFilter}
              onChange={(e) => setListStatusFilter(e.target.value as typeof listStatusFilter)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="confirmed">Confirmed</option>
              <option value="paid">Paid</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="disputed">Disputed</option>
              <option value="refunded">Refunded</option>
            </select>
            <button
              type="button"
              onClick={() => setListFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                listFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setListFilter('disputes')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 ${
                listFilter === 'disputes'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <AlertTriangle size={12} />
              Disputes only
            </button>
            <input
              type="text"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter buyer, seller, title, ID…"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs w-56 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500 ml-auto">
              {filteredList.length} booking{filteredList.length === 1 ? '' : 's'}
            </span>
          </div>

          {listLoading && list.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : filteredList.length === 0 ? (
            <EmptyState icon={Package} message="No bookings for this filter yet." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-bold text-gray-600">ID</th>
                    <th className="text-left p-3 font-bold text-gray-600">Status</th>
                    <th className="text-left p-3 font-bold text-gray-600">Dispute</th>
                    <th className="text-left p-3 font-bold text-gray-600">Amount</th>
                    <th className="text-left p-3 font-bold text-gray-600">Buyer</th>
                    <th className="text-left p-3 font-bold text-gray-600">Seller</th>
                    <th className="text-left p-3 font-bold text-gray-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-blue-50/70 cursor-pointer"
                      onClick={() => void openBookingByQuery(row.id)}
                    >
                      <td className="p-3 font-mono text-xs">{String(row.id).slice(0, 8)}…</td>
                      <td className="p-3">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="p-3">
                        {row.has_dispute || row.status === 'disputed' || row.status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                            <AlertTriangle size={11} />
                            {prettyDisputeState(row.dispute_state as BookingDetail['dispute_state']) ?? 'Dispute'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        {formatMoney(row.amount_minor ?? 0, row.currency_code)}
                      </td>
                      <td className="p-3">{row.buyer_display_name ?? '—'}</td>
                      <td className="p-3">{row.seller_display_name ?? '—'}</td>
                      <td className="p-3 text-gray-500">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lookup' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <form onSubmit={searchBooking} className="flex gap-2 w-full md:w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Booking UUID, order UUID, or Paystack ref…"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-(--primary) text-sm font-mono"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lookup'}
              </button>
            </form>
            {booking ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list')
                  setBooking(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to recent bookings
              </button>
            ) : null}
          </div>

          {loading && !booking ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : booking ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-stretch">
                  <div className="flex-1 p-5 lg:p-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={status} large />
                      {(booking.dispute_metadata || (booking.dispute_state && booking.dispute_state !== 'none')) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200">
                          <AlertTriangle size={12} />
                          {prettyDisputeState(booking.dispute_state) ?? 'Dispute metadata'}
                        </span>
                      )}
                      {lastRefundRef ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <CheckCircle size={12} /> Refund: {lastRefundRef}
                        </span>
                      ) : null}
                      {booking.policy_url ? (
                        <a
                          href={booking.policy_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 ring-1 ring-gray-200 hover:bg-gray-100"
                        >
                          Service policies <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Booking</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm text-gray-900 break-all">{booking.id}</p>
                        <button
                          type="button"
                          onClick={() => void copyText(booking.id, 'Booking ID')}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <MetaTile
                        icon={Wallet}
                        label="Amount"
                        value={formatMoney(booking.amount_minor, booking.currency_code)}
                        mono
                      />
                      <MetaTile
                        icon={CreditCard}
                        label="Paystack / linked ref"
                        value={payRef || '—'}
                        mono
                        onCopy={payRef ? () => void copyText(String(payRef), 'Payment ref') : undefined}
                      />
                      <MetaTile
                        icon={Package}
                        label="Linked order"
                        value={booking.linked_order_id || '—'}
                        mono
                        onCopy={
                          booking.linked_order_id
                            ? () => void copyText(booking.linked_order_id!, 'Linked order ID')
                            : undefined
                        }
                        href={
                          booking.linked_order_id
                            ? `/dashboard/orders?q=${encodeURIComponent(booking.linked_order_id)}`
                            : undefined
                        }
                      />
                      <MetaTile
                        icon={Calendar}
                        label="Scheduled"
                        value={booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString() : '—'}
                      />
                    </div>

                    {escrow ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <EscrowPill label="Total" value={formatMoney(escrow.amount_minor_total, booking.currency_code)} />
                        <EscrowPill label="Held" value={formatMoney(escrow.amount_minor_held, booking.currency_code)} />
                        <EscrowPill
                          label="Released start"
                          value={formatMoney(escrow.amount_minor_released_start, booking.currency_code)}
                        />
                        <EscrowPill
                          label="Released complete"
                          value={formatMoney(escrow.amount_minor_released_complete, booking.currency_code)}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/80 p-5 lg:p-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Service</p>
                    {booking.listing ? (
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-900 leading-snug">{booking.listing.title}</p>
                        <p className="text-xs text-gray-500">
                          {booking.listing.service_category}
                          {booking.listing.hero_price_min != null
                            ? ` · from ${formatMoney(booking.listing.hero_price_min, booking.listing.currency_code || booking.currency_code)}`
                            : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No listing linked</p>
                    )}
                    {booking.service_menu_item?.name ? (
                      <p className="mt-3 text-xs text-gray-600">
                        Menu: <span className="font-semibold">{booking.service_menu_item.name}</span>
                      </p>
                    ) : null}
                    {booking.is_custom_quote && booking.custom_description ? (
                      <p className="mt-3 text-xs text-gray-600 whitespace-pre-wrap">{booking.custom_description}</p>
                    ) : null}
                    <p className="mt-4 text-[11px] text-gray-400 font-mono">
                      Created {booking.created_at ? new Date(booking.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {(disputeReason || disputeNote) && (
                    <section className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-2">
                      <h3 className="text-sm font-bold text-orange-950 flex items-center gap-2">
                        <AlertTriangle size={14} /> Dispute details
                      </h3>
                      {disputeReason ? (
                        <p className="text-xs text-gray-800">
                          <span className="font-semibold">Reason:</span> {disputeReason}
                        </p>
                      ) : null}
                      {disputeNote ? (
                        <p className="text-xs text-gray-800">
                          <span className="font-semibold">Note:</span> {disputeNote}
                        </p>
                      ) : null}
                    </section>
                  )}

                  <ServiceBookingTimelinePanel
                    payload={booking.booking_timeline}
                    currencyCode={booking.currency_code}
                  />

                  {booking.conversation_id ? (
                    <ChatCommerceLinksPanel
                      key={`booking-chat-${booking.conversation_id}`}
                      chatId={booking.conversation_id}
                      title="Chat commerce context"
                      description="Orders and bookings in the same P2P thread as this booking. Open P2P viewer for full transcript."
                    />
                  ) : null}

                  {booking.conversation_id && isActiveServiceDispute(booking) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-bold text-amber-950">Booking chat (dispute)</h3>
                          <p className="text-[11px] text-amber-900/90 mt-1 leading-relaxed">
                            Load the buyer–seller thread for this booking. Access is limited to active disputes; each load
                            is written to the audit log.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={disputeChatLoading}
                        onClick={() => void loadDisputeChat()}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white hover:bg-amber-950 disabled:opacity-50"
                      >
                        {disputeChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                        Load messages
                      </button>
                      {disputeChatError && <p className="text-xs font-semibold text-red-700">{disputeChatError}</p>}
                      {disputeChatMessages.length > 0 && (
                        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-amber-200/80 bg-white">
                          {disputeChatMessages.map((m) => {
                            const att = attachmentSummary(m)
                            const when = m.created_at ? new Date(m.created_at).toLocaleString() : '—'
                            const role = m.sender_role || '—'
                            const body = (m.text || '').trim()
                            return (
                              <div
                                key={m.message_id}
                                className="border-b border-gray-100 px-3 py-2.5 text-xs last:border-b-0"
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                                  <span className="font-mono text-gray-400">{when}</span>
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-bold uppercase text-gray-700">
                                    {role}
                                  </span>
                                  <span className="font-semibold text-gray-800">
                                    {m.sender_display_name || 'Unknown'}
                                  </span>
                                </div>
                                {body ? (
                                  <p className="mt-1 whitespace-pre-wrap text-gray-900">{body}</p>
                                ) : att ? (
                                  <p className="mt-1 flex items-center gap-1 text-gray-600">
                                    {m.image_url || m.gif_url ? (
                                      <ImageIcon className="h-3.5 w-3.5" />
                                    ) : (
                                      <FileText className="h-3.5 w-3.5" />
                                    )}
                                    {att}
                                  </p>
                                ) : (
                                  <p className="mt-1 italic text-gray-400">[empty]</p>
                                )}
                                {m.reply_to_snippet ? (
                                  <p className="mt-1 border-l-2 border-gray-200 pl-2 text-[10px] text-gray-500">
                                    Replying to: {m.reply_to_snippet}
                                  </p>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Parties
                    </div>
                    <div className="p-4 space-y-4">
                      <PartyBlock role="Buyer" party={booking.buyer} />
                      <hr className="border-gray-100" />
                      <PartyBlock role="Seller" party={booking.seller} />
                    </div>
                  </section>

                  {canIntervene ? (
                    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <h4 className="text-xs font-bold text-red-800 uppercase mb-2 flex items-center gap-2">
                        <AlertTriangle size={14} /> Intervention
                      </h4>
                      <p className="text-[11px] text-red-700/90 mb-3">
                        Overrides skip the normal booking flow. Always leave a reason — audited.
                      </p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={actionLoading || bookingBlocksForceComplete(booking)}
                          onClick={() => setPendingStatus('completed')}
                          title={
                            bookingBlocksForceComplete(booking)
                              ? 'Blocked until deposit booking is paid in full (escrow fully funded).'
                              : undefined
                          }
                          className="w-full bg-white border border-red-200 text-red-700 font-bold py-2 rounded-lg text-xs hover:bg-red-100 transition flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Force complete
                        </button>
                        {bookingBlocksForceComplete(booking) ? (
                          <p className="text-[10px] text-red-700/80 leading-snug">
                            Force complete blocked until paid in full
                            {booking.booking_timeline?.payment_state
                              ? ` (now: ${booking.booking_timeline.payment_state})`
                              : ''}
                            .
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setPendingStatus('cancelled')}
                          className="w-full bg-red-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-red-700 transition flex items-center justify-center gap-2"
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          Force cancel (no refund)
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setPendingStatus('refunded')}
                          className="w-full bg-orange-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-orange-700 transition flex items-center justify-center gap-2"
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                          Force refund (company-funded)
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h4 className="text-xs font-bold text-gray-600 uppercase mb-1">Interventions</h4>
                      <p className="text-[11px] text-gray-500">
                        This booking is <span className="font-bold text-gray-800">{status}</span>. Force actions are
                        closed.
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Search} message="Enter a booking UUID, linked order UUID, or Paystack ref." />
          )}
        </>
      )}

      <ActionReasonModal
        open={pendingStatus !== null}
        title={
          pendingStatus === 'completed'
            ? 'Confirm Force Complete'
            : pendingStatus === 'cancelled'
              ? 'Confirm Force Cancel'
              : 'Confirm Force Refund'
        }
        description="Provide a reason for this admin intervention."
        impactSummary={
          pendingStatus === 'completed'
            ? 'Booking will be marked complete only if escrow is paid in full; otherwise the server rejects the action.'
            : pendingStatus === 'cancelled'
              ? 'Booking will be cancelled without running a payment refund. Use for unpaid/invalid bookings.'
              : 'Booking will be marked refunded and refund execution will be attempted. Use for approved dispute outcomes.'
        }
        categoryOptions={[
          { value: 'fraud', label: 'Fraud risk' },
          { value: 'payment_issue', label: 'Payment issue' },
          { value: 'customer_request', label: 'Customer request' },
          { value: 'no_show', label: 'No-show' },
          { value: 'fulfillment_issue', label: 'Fulfillment issue' },
          { value: 'compliance', label: 'Compliance' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={actionLoading}
        onClose={() => setPendingStatus(null)}
        onSubmit={({ category, reason }) => {
          if (!pendingStatus) return
          return forceStatus({ status: pendingStatus, category, reason })
        }}
      />
    </div>
  )
}

function PartyBlock({
  role,
  party,
}: {
  role: string
  party?: BookingDetail['buyer'] | null
}) {
  return (
    <div className="flex items-start gap-3">
      <AdminAvatar size="md" src={party?.logo_url} name={party?.display_name || role} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{role}</p>
        <p className="font-bold text-gray-900 truncate">{party?.display_name || '—'}</p>
        {party?.email ? <p className="text-xs text-gray-500 truncate">{party.email}</p> : null}
        {party?.phone ? <p className="text-xs text-gray-500">{party.phone}</p> : null}
        {party?.id ? (
          <Link
            href={`/dashboard/users?q=${encodeURIComponent(party.id)}`}
            className="mt-1 inline-flex text-[11px] font-bold text-blue-600 hover:underline"
          >
            Open user
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function MetaTile({
  icon: Icon,
  label,
  value,
  mono,
  onCopy,
  href,
}: {
  icon: any
  label: string
  value: string
  mono?: boolean
  onCopy?: () => void
  href?: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Icon size={11} /> {label}
        </p>
        <div className="flex items-center gap-1">
          {href && value !== '—' ? (
            <Link href={href} className="text-blue-600 hover:text-blue-800">
              <ExternalLink size={12} />
            </Link>
          ) : null}
          {onCopy ? (
            <button type="button" onClick={onCopy} className="text-gray-400 hover:text-gray-700">
              <Copy size={12} />
            </button>
          ) : null}
        </div>
      </div>
      <p className={`mt-1 text-sm text-gray-900 break-all ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</p>
    </div>
  )
}

function EscrowPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-xs font-mono font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function StatusChip({ status, large }: { status: string; large?: boolean }) {
  const s = String(status || '').toLowerCase()
  const styles: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    cancelled: 'bg-red-50 text-red-700 ring-red-200',
    refunded: 'bg-rose-50 text-rose-700 ring-rose-200',
    paid: 'bg-sky-50 text-sky-700 ring-sky-200',
    confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
    in_progress: 'bg-violet-50 text-violet-700 ring-violet-200',
    disputed: 'bg-orange-50 text-orange-700 ring-orange-200',
    requested: 'bg-amber-50 text-amber-800 ring-amber-200',
  }
  const cls = styles[s] || 'bg-gray-50 text-gray-700 ring-gray-200'
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 font-bold ${cls} ${
        large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {s || 'unknown'}
    </span>
  )
}

function getNoShowReasonFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null
  const claim =
    (meta as { dispute_claim?: { reason?: unknown } }).dispute_claim ||
    (meta as { no_show_claim?: { reason?: unknown } }).no_show_claim
  if (!claim || typeof claim !== 'object') return null
  const raw = claim.reason
  if (typeof raw !== 'string' || !raw.trim()) return null
  return formatServiceDisputeReason(raw.trim()) || raw.trim()
}

function getNoShowNoteFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null
  const claim =
    (meta as { dispute_claim?: { note?: unknown } }).dispute_claim ||
    (meta as { no_show_claim?: { note?: unknown } }).no_show_claim
  if (!claim || typeof claim !== 'object') return null
  const raw = claim.note
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}
