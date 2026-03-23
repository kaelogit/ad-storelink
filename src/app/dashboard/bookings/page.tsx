'use client'

import { useState } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { parseApiError } from '../../../utils/http'
import {
  Search,
  Calendar,
  User,
  MapPin,
  Package,
  Loader2,
  RefreshCcw,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'

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
  buyer: { id: string; display_name: string; email: string; phone: string; location_city: string; location_state: string }
  seller: { id: string; display_name: string; email: string; phone: string; location_city: string; location_state: string }
  listing: { id: string; title: string; service_category: string; hero_price_min: number; currency_code: string } | null
  escrow_breakdown: {
    amount_minor_total: number
    amount_minor_held: number
    amount_minor_released_start: number
    amount_minor_released_complete: number
  }
  linked_order_id: string | null
  policy_url?: string
}

function fromSmallestUnit(amountMinor: number, currencyCode: string): number {
  const code = (currencyCode || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return Number(amountMinor || 0) / Math.pow(10, decimals)
}

export default function BookingsPage() {
  const supabase = createClient()
  const { countryCode } = useCountryFilter()
  const [query, setQuery] = useState('')
  const [booking, setBooking] = useState<BookingDetail | null>(null)
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
  const [list, setList] = useState<BookingListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'cancelled' | 'refunded' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'lookup' | 'list'>('lookup')
  const [listFilter, setListFilter] = useState<'all' | 'disputes'>('all')
  const [listStatusFilter, setListStatusFilter] = useState<
    'all' | 'requested' | 'confirmed' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'disputed' | 'refunded'
  >('all')
  const [listQuery, setListQuery] = useState('')
  const [lastRefundRef, setLastRefundRef] = useState<string | null>(null)

  const searchBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setBooking(null)
    setLastRefundRef(null)
    const { data, error } = await supabase.rpc('get_service_order_details_for_admin', {
      p_query: query.trim(),
    })
    if (data) setBooking(data as BookingDetail)
    else if (!data && !error) setFeedback({ tone: 'error', message: 'Booking not found. Try service order UUID or order UUID.' })
    setLoading(false)
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
    }
    setListLoading(false)
  }

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
    setBooking(data as BookingDetail)
    setPendingStatus(null)
    const refundMsg =
      status === 'refunded'
        ? payload?.refund?.executed
          ? ` Refund executed for order ${payload.refund.orderId?.slice(0, 8) ?? 'linked order'}.`
          : ' Booking status changed but refund execution was not confirmed.'
        : ''
    const clawbackMsg =
      status === 'refunded' && payload?.clawbackDebt?.id
        ? ` Seller clawback debt opened: ${payload.clawbackDebt.currencyCode ?? booking.currency_code} ${fromSmallestUnit(payload.clawbackDebt.amountMinor ?? 0, payload.clawbackDebt.currencyCode ?? booking.currency_code).toLocaleString()}. Seller access is locked until repayment.`
        : ''
    if (status === 'refunded' && payload?.refund?.executed && payload.refund.paystackReference) {
      setLastRefundRef(payload.refund.paystackReference)
    } else if (status !== 'refunded') {
      setLastRefundRef(null)
    }
    setFeedback({ tone: 'success', message: `Booking status updated to ${status}.${refundMsg}${clawbackMsg}`.trim() })
    setActionLoading(false)
  }

  const terminalStatuses = new Set(['completed', 'cancelled', 'refunded'])
  const canIntervene = booking && !terminalStatuses.has(booking.status)

  const baseList =
    listFilter === 'disputes'
      ? list.filter((row) => row.has_dispute || row.status === 'disputed' || row.status === 'refunded')
      : list

  const searchTerm = listQuery.trim().toLowerCase()
  const filteredList = searchTerm
    ? baseList.filter((row) => {
        const haystack = [
          row.id,
          row.buyer_display_name,
          row.seller_display_name,
          row.listing_title,
        ]
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
    ? booking.dispute_reason || getNoShowReasonFromMetadata(booking.dispute_metadata)
    : null
  const disputeNote = booking
    ? booking.dispute_note || getNoShowNoteFromMetadata(booking.dispute_metadata)
    : null

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Bookings (Service Orders)"
        subtitle="Look up service bookings by ID or order ID. Force complete, cancel, or refund with audit reasons."
      />
      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('lookup')}
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'lookup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Lookup
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('list')
            loadList()
          }}
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Recent list
        </button>
      </div>

      {activeTab === 'lookup' && (
        <>
          <form onSubmit={searchBooking} className="flex gap-2 w-full max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Service order UUID or Order UUID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition flex items-center gap-2">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lookup'}
            </button>
          </form>

          {booking && (
            <div className="grid grid-cols-1 lg:grid-span-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`text-2xl font-black ${booking.status === 'completed' ? 'text-green-600' : booking.status === 'cancelled' || booking.status === 'refunded' ? 'text-red-600' : 'text-gray-700'}`}>
                      {booking.status}
                    </span>
                    {(booking.dispute_metadata || booking.dispute_state && booking.dispute_state !== 'none') && (
                      <div className="mt-2 flex items-center gap-2 text-orange-700 bg-orange-50 px-2 py-1 rounded text-xs font-bold w-fit">
                        <AlertTriangle size={12} />
                        <span>
                          {prettyDisputeState(booking.dispute_state) ?? 'Dispute metadata present'}
                        </span>
                      </div>
                    )}
                    {lastRefundRef && (
                      <div className="mt-2 flex items-center gap-2 rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 w-fit">
                        <CheckCircle size={12} />
                        <span className="font-semibold">Refund ref:</span>
                        <span className="font-mono">{lastRefundRef}</span>
                      </div>
                    )}
                    {booking.policy_url && (
                      <a
                        href={booking.policy_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-[11px] font-semibold text-blue-600 underline"
                      >
                        View service policies
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Amount</p>
                    <span className="text-2xl font-mono text-gray-900">
                      {booking.currency_code} {(booking.amount_minor / 100).toLocaleString()}
                    </span>
                  </div>
                </div>

              {(disputeReason || disputeNote) && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                  <h3 className="text-sm font-bold text-gray-900">Dispute details</h3>
                  {disputeReason && (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold">Reason:</span>{' '}
                      <span className="font-mono">{disputeReason}</span>
                    </p>
                  )}
                  {disputeNote && (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold">Note:</span>{' '}
                      {disputeNote}
                    </p>
                  )}
                </div>
              )}

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Parties</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-full text-blue-600"><User size={16} /></div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Buyer</p>
                        <p className="font-bold text-gray-900">{booking.buyer?.display_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{booking.buyer?.email}</p>
                        <p className="text-xs text-gray-500">{booking.buyer?.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-full text-purple-600"><User size={16} /></div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Seller</p>
                        <p className="font-bold text-gray-900">{booking.seller?.display_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{booking.seller?.email}</p>
                        <p className="text-xs text-gray-500">{booking.seller?.phone}</p>
                      </div>
                    </div>
                  </div>
                  {booking.listing && (
                    <div className="mt-4 flex items-start gap-3">
                      <Package size={16} className="text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Service</p>
                        <p className="font-bold text-gray-900">{booking.listing.title}</p>
                        <p className="text-xs text-gray-500">{booking.listing.service_category} · {booking.currency_code} {(booking.listing.hero_price_min / 100).toLocaleString()}+</p>
                      </div>
                    </div>
                  )}
                  {booking.scheduled_at && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} />
                      {new Date(booking.scheduled_at).toLocaleString()}
                    </div>
                  )}
                  {booking.linked_order_id && (
                    <p className="text-xs text-gray-500 mt-2">Linked order: <span className="font-mono">{booking.linked_order_id}</span></p>
                  )}
                </div>

                {booking.escrow_breakdown && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <h3 className="text-sm font-bold text-gray-900">Escrow</h3>
                    <p className="text-xs text-gray-600">
                      Total: {booking.currency_code} {(booking.escrow_breakdown.amount_minor_total / 100).toLocaleString()} ·
                      Held: {(booking.escrow_breakdown.amount_minor_held / 100).toLocaleString()} ·
                      Released (30%): {(booking.escrow_breakdown.amount_minor_released_start / 100).toLocaleString()} ·
                      Released (70%): {(booking.escrow_breakdown.amount_minor_released_complete / 100).toLocaleString()}
                    </p>
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        Timeline
                      </p>
                      <ol className="space-y-1 text-xs text-gray-600">
                        <li>
                          <span className="font-semibold">Requested</span>{' '}
                          <span className="text-gray-500">
                            · {new Date(booking.created_at).toLocaleString()}
                          </span>
                        </li>
                        {booking.scheduled_at && (
                          <li>
                            <span className="font-semibold">Scheduled for</span>{' '}
                            <span className="text-gray-500">
                              · {new Date(booking.scheduled_at).toLocaleString()}
                            </span>
                          </li>
                        )}
                        {booking.released_at_start && (
                          <li>
                            <span className="font-semibold">Job started (30% released)</span>{' '}
                            <span className="text-gray-500">
                              · {new Date(booking.released_at_start).toLocaleString()}
                            </span>
                          </li>
                        )}
                        {booking.released_at_complete && (
                          <li>
                            <span className="font-semibold">Completed (70% released)</span>{' '}
                            <span className="text-gray-500">
                              · {new Date(booking.released_at_complete).toLocaleString()}
                            </span>
                          </li>
                        )}
                        <li>
                          <span className="font-semibold">Current status</span>{' '}
                          <span className="text-gray-500">
                            · {booking.status} (last update {new Date(booking.updated_at).toLocaleString()})
                          </span>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {canIntervene && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-red-800 uppercase mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} /> Intervention
                    </h4>
                    <div className="space-y-2">
                      <button
                        disabled={actionLoading}
                        onClick={() => setPendingStatus('completed')}
                        className="w-full bg-white border border-red-200 text-red-700 font-bold py-2 rounded text-xs hover:bg-red-100 transition flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Force Complete
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => setPendingStatus('cancelled')}
                        className="w-full bg-red-600 text-white font-bold py-2 rounded text-xs hover:bg-red-700 transition flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        Force Cancel (No Refund)
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => setPendingStatus('refunded')}
                        className="w-full bg-orange-600 text-white font-bold py-2 rounded text-xs hover:bg-orange-700 transition flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                        Force Refund (Company-Funded)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={loadList}
            disabled={listLoading}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black flex items-center gap-2 disabled:opacity-50"
          >
            {listLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCcw size={14} />}
            Refresh
          </button>
          {filteredList.length === 0 && !listLoading && (
            <EmptyState icon={Package} message="No bookings in this country or load the list." />
          )}
          {filteredList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 border-b border-gray-200 text-xs text-gray-600">
                <span className="whitespace-nowrap">
                  Showing {filteredList.length}{' '}
                  {listFilter === 'disputes' ? 'bookings with disputes' : 'recent bookings'}
                </span>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <input
                    type="text"
                    placeholder="Filter by buyer, seller, title, ID…"
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    className="hidden md:block w-64 px-2 py-1 border border-gray-200 rounded-lg text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setListFilter('all')}
                    className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${
                      listFilter === 'all'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter('disputes')}
                    className={`px-2 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1 ${
                      listFilter === 'disputes'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    <AlertTriangle size={12} />
                    Disputes only
                  </button>
                  <select
                    value={listStatusFilter}
                    onChange={(e) =>
                      setListStatusFilter(e.target.value as typeof listStatusFilter)
                    }
                    className="px-2 py-1 border border-gray-200 rounded-full text-[11px] font-semibold bg-white text-gray-600"
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
                </div>
              </div>
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
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={async () => {
                        setQuery(row.id)
                        setActiveTab('lookup')
                        setLoading(true)
                        setBooking(null)
                        const { data } = await supabase.rpc('get_service_order_details_for_admin', { p_query: row.id })
                        setBooking(data as BookingDetail)
                        setLoading(false)
                      }}
                    >
                      <td className="p-3 font-mono text-xs">{String(row.id).slice(0, 8)}…</td>
                      <td className="p-3">
                        <span className="font-bold">{row.status}</span>
                      </td>
                      <td className="p-3">
                        {row.has_dispute || row.status === 'disputed' || row.status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                            <AlertTriangle size={11} />
                            {prettyDisputeState(row.dispute_state as any) ?? 'Dispute'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">{row.currency_code} {((row.amount_minor ?? 0) / 100).toLocaleString()}</td>
                      <td className="p-3">{row.buyer_display_name ?? '—'}</td>
                      <td className="p-3">{row.seller_display_name ?? '—'}</td>
                      <td className="p-3 text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
            ? 'Booking will be marked complete; escrow 70% can be released.'
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

function getNoShowReasonFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null
  const claim = (meta as { no_show_claim?: { reason?: unknown } }).no_show_claim
  if (!claim || typeof claim !== 'object') return null
  const raw = claim.reason
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function getNoShowNoteFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null
  const claim = (meta as { no_show_claim?: { note?: unknown } }).no_show_claim
  if (!claim || typeof claim !== 'object') return null
  const raw = claim.note
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}
