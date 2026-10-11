'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { DeskLinkPills } from '../../../components/admin/DeskLinkPills'
import { EmptyState } from '../../../components/admin/EmptyState'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { parseApiError } from '../../../utils/http'
import { DisputeChatTranscriptPanel } from '../../../components/admin/DisputeChatTranscriptPanel'
import { ChatCommerceLinksPanel } from '../../../components/admin/ChatCommerceLinksPanel'
import { isActiveProductOrderDispute } from '../../../utils/disputeChat'
import { useCountryFilter } from '../../../contexts/CountryFilterContext'
import { ALL_COUNTRIES_CODE } from '../../../constants/SupportedCountries'
import {
  Search,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Loader2,
  RefreshCcw,
  CreditCard,
  Copy,
  ArrowLeft,
  ExternalLink,
  Coins,
} from 'lucide-react'

type OrderListRow = {
  id: string
  status: string
  total_amount: number
  currency_code: string
  payment_reference: string | null
  buyer_display_name: string
  seller_display_name: string
  item_count: number
  created_at: string
}

type OrderParty = {
  id?: string | null
  name?: string | null
  display_name?: string | null
  slug?: string | null
  email?: string | null
  phone?: string | null
}

type OrderItem = {
  name?: string | null
  quantity?: number | null
  price?: number | null
  image?: string | null
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED'])
const PAID_LIKE = new Set(['PAID', 'SHIPPED', 'COMPLETED', 'DISPUTED'])

export default function OrderOps() {
  const supabase = createClient()
  const { countryCode } = useCountryFilter()
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'COMPLETED' | 'CANCELLED' | null>(null)
  const [markPaidRef, setMarkPaidRef] = useState('')
  const [markPaidLoading, setMarkPaidLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'lookup'>('list')
  const [list, setList] = useState<OrderListRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listStatus, setListStatus] = useState<string>('all')
  const [listQuery, setListQuery] = useState('')

  const enrichOrderWithCoinOps = async (orderPayload: any) => {
    if (!orderPayload?.id) return orderPayload
    const { data: orderCoin } = await supabase
      .from('orders')
      .select('coin_redeemed, user_id, chat_id')
      .eq('id', orderPayload.id)
      .maybeSingle()

    let buyerCoinBalance: number | null = null
    if (orderCoin?.user_id) {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', orderCoin.user_id)
        .maybeSingle()
      buyerCoinBalance = Number(buyerProfile?.coin_balance ?? 0)
    }

    return {
      ...orderPayload,
      coin_redeemed: Number(orderCoin?.coin_redeemed ?? 0),
      buyer_coin_balance: buyerCoinBalance,
      chat_id: orderCoin?.chat_id ?? null,
    }
  }

  const openOrderByQuery = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setLoading(true)
    setOrder(null)
    setActiveTab('lookup')
    setQuery(q)
    const { data } = await supabase.rpc('get_order_details', { p_query: q })
    if (data) {
      const enriched = await enrichOrderWithCoinOps(data)
      setOrder(enriched)
    } else {
      setFeedback({ tone: 'error', message: 'Order not found. Check UUID or reference.' })
    }
    setLoading(false)
  }

  const searchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    await openOrderByQuery(query)
  }

  const loadList = useCallback(async () => {
    setListLoading(true)
    const { data, error } = await supabase.rpc('get_admin_orders', {
      p_country_code: countryCode === ALL_COUNTRIES_CODE ? null : countryCode,
      p_status: listStatus === 'all' ? null : listStatus,
      p_limit: 100,
      p_offset: 0,
    })
    if (!error && Array.isArray(data)) {
      setList(data as OrderListRow[])
    } else {
      setList([])
      if (error) {
        setFeedback({
          tone: 'error',
          message:
            error.message ||
            'Failed to load orders. Apply migration 20261120810000 if get_admin_orders is missing.',
        })
      }
    }
    setListLoading(false)
  }, [countryCode, listStatus, supabase])

  useEffect(() => {
    if (activeTab === 'list') void loadList()
  }, [activeTab, loadList])

  const markOrderPaidByReference = async () => {
    const ref = markPaidRef?.trim()
    if (!ref || !order) return
    setMarkPaidLoading(true)
    setFeedback({ tone: 'info', message: 'Marking order as paid...' })
    const response = await fetch('/api/admin/orders/mark-paid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `mark-paid-${order.id}-${ref}`,
      },
      body: JSON.stringify({ orderId: order.id, paymentReference: ref }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      setFeedback({ tone: 'error', message: (err as any).error || 'Failed to mark as paid.' })
      setMarkPaidLoading(false)
      return
    }
    const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
    const enriched = await enrichOrderWithCoinOps(updated)
    setOrder(enriched)
    setMarkPaidRef('')
    setFeedback({ tone: 'success', message: 'Order marked as PAID. Chat notification added if applicable.' })
    setMarkPaidLoading(false)
  }

  const forceUpdateStatus = async ({
    status,
    reason,
    category,
  }: {
    status: 'COMPLETED' | 'CANCELLED'
    reason: string
    category: string
  }) => {
    setActionLoading(true)
    setFeedback({ tone: 'info', message: `Applying order status ${status}...` })

    const response = await fetch('/api/admin/orders/force-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `order-force-status-${order.id}-${status}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        newStatus: status,
        reasonCategory: category,
        reason,
      }),
    })

    if (!response.ok) {
      const errorMessage = await parseApiError(response, 'Failed to update order status.')
      setFeedback({ tone: 'error', message: errorMessage })
      setActionLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      refund?: { executed?: boolean; paystackReference?: string | null }
      mode?: string
    }

    const { data: updated } = await supabase.rpc('get_order_details', { p_query: order.id })
    const enriched = await enrichOrderWithCoinOps(updated)
    setOrder(enriched)
    setPendingStatus(null)
    const refundMsg =
      status === 'CANCELLED'
        ? payload?.refund?.executed
          ? ` Refund executed${payload.refund.paystackReference ? ` (${payload.refund.paystackReference})` : ''}.`
          : ''
        : ''
    setFeedback({ tone: 'success', message: `Order status updated to ${status}.${refundMsg}`.trim() })
    setActionLoading(false)
  }

  const filteredList = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (row) =>
        row.id.toLowerCase().includes(q) ||
        (row.payment_reference || '').toLowerCase().includes(q) ||
        (row.buyer_display_name || '').toLowerCase().includes(q) ||
        (row.seller_display_name || '').toLowerCase().includes(q) ||
        (row.status || '').toLowerCase().includes(q)
    )
  }, [list, listQuery])

  const status = String(order?.status || '').toUpperCase()
  const isTerminal = TERMINAL_STATUSES.has(status)
  const items: OrderItem[] = Array.isArray(order?.items) ? order.items : []

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ tone: 'success', message: `${label} copied.` })
    } catch {
      setFeedback({ tone: 'error', message: `Could not copy ${label}.` })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Transaction Ops"
        subtitle="Browse every product order, click for full detail, or look up by UUID / Paystack ref. Stuck AWAITING_PAYMENT → Payment incidents."
        actions={
          <DeskLinkPills
            links={[
              { href: '/dashboard/payment-incidents', label: 'Stuck payments queue' },
              { href: '/dashboard/finance', label: 'Finance' },
              { href: '/dashboard/support', label: 'Support' },
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
            setOrder(null)
          }}
          className={`px-4 py-2 text-sm font-bold ${activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Recent orders
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
              value={listStatus}
              onChange={(e) => setListStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="AWAITING_PAYMENT">AWAITING_PAYMENT</option>
              <option value="PAID">PAID</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="DISPUTED">DISPUTED</option>
            </select>
            <input
              type="text"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter buyer, seller, ref, id…"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs w-56 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {listLoading && list.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : filteredList.length === 0 ? (
            <EmptyState icon={Package} message="No product orders for this filter yet." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-bold text-gray-600">ID</th>
                    <th className="text-left p-3 font-bold text-gray-600">Status</th>
                    <th className="text-left p-3 font-bold text-gray-600">Amount</th>
                    <th className="text-left p-3 font-bold text-gray-600">Buyer</th>
                    <th className="text-left p-3 font-bold text-gray-600">Seller</th>
                    <th className="text-left p-3 font-bold text-gray-600">Paystack ref</th>
                    <th className="text-left p-3 font-bold text-gray-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-blue-50/70 cursor-pointer"
                      onClick={() => void openOrderByQuery(row.id)}
                    >
                      <td className="p-3 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                      <td className="p-3">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="p-3 font-mono">
                        {row.currency_code} {Number(row.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3">{row.buyer_display_name}</td>
                      <td className="p-3">{row.seller_display_name}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{row.payment_reference || '—'}</td>
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
            <form onSubmit={searchOrder} className="flex gap-2 w-full md:w-[28rem]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Paste Order UUID or Paystack Ref..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-(--primary) text-sm font-mono"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
              >
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lookup'}
              </button>
            </form>
            {order ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list')
                  setOrder(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to recent orders
              </button>
            ) : null}
          </div>

          {order ? (
            <div className="space-y-6">
              {/* Case header */}
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-stretch">
                  <div className="flex-1 p-5 lg:p-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={status} large />
                      {order.dispute ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                          <AlertTriangle size={12} /> Dispute: {order.dispute.reason}
                        </span>
                      ) : null}
                      {status === 'AWAITING_PAYMENT' && !order.reference ? (
                        <Link
                          href="/dashboard/payment-incidents"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                        >
                          Stuck payments queue <ExternalLink size={11} />
                        </Link>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Order</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm text-gray-900 break-all">{order.id}</p>
                        <button
                          type="button"
                          onClick={() => void copyText(String(order.id), 'Order ID')}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <MetaTile
                        icon={CreditCard}
                        label="Paystack ref"
                        value={order.reference || '—'}
                        mono
                        onCopy={order.reference ? () => void copyText(String(order.reference), 'Paystack ref') : undefined}
                      />
                      <MetaTile
                        icon={Package}
                        label="Total"
                        value={`${order.currency || 'NGN'} ${Number(order.amount || 0).toLocaleString()}`}
                        mono
                      />
                      <MetaTile
                        icon={Coins}
                        label="Coins redeemed"
                        value={Number(order.coin_redeemed || 0).toLocaleString()}
                      />
                      <MetaTile
                        icon={Coins}
                        label="Buyer coin balance (now)"
                        value={Number(order.buyer_coin_balance || 0).toLocaleString()}
                      />
                    </div>
                  </div>
                  <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/80 p-5 lg:p-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Lifecycle</p>
                    <OrderTimeline order={order} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Line items */}
                  <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">Line items</h3>
                      <span className="text-xs text-gray-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500">No line items on this order.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {items.map((item, idx) => (
                          <li key={`${item.name}-${idx}`} className="flex items-center gap-3 px-4 py-3">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-gray-100" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.name || 'Product'}</p>
                              <p className="text-xs text-gray-500">Qty {item.quantity ?? 1}</p>
                            </div>
                            <p className="text-sm font-mono text-gray-800">
                              {order.currency || 'NGN'} {Number(item.price || 0).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {order.chat_id ? (
                    <ChatCommerceLinksPanel
                      key={`order-chat-${order.chat_id}`}
                      chatId={order.chat_id}
                      title="Chat commerce context"
                      description="Orders and bookings in the same P2P thread as this order. Open P2P viewer for full transcript."
                    />
                  ) : null}

                  {order.chat_id && isActiveProductOrderDispute(order) && (
                    <DisputeChatTranscriptPanel
                      key={order.id}
                      title="Order chat (dispute)"
                      description="Load the buyer–seller thread for this order. Access is limited to active disputes; each load is written to the audit log. Use only for resolving this case."
                      conversationId={order.chat_id}
                      entityId={order.id}
                      endpoint="/api/admin/orders/order-chat"
                      requestBody={{ orderId: order.id }}
                      onLoaded={(count) =>
                        setFeedback({
                          tone: 'info',
                          message: `Loaded ${count} message(s). View is audit-logged.`,
                        })
                      }
                    />
                  )}
                </div>

                <div className="space-y-6">
                  <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Parties
                    </div>
                    <div className="p-4 space-y-4">
                      <PartyCard role="Buyer" party={order.buyer} accent="buyer" />
                      <hr className="border-gray-100" />
                      <PartyCard role="Seller" party={order.seller} accent="seller" />
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-gray-100 p-2 rounded-full text-gray-600">
                        <MapPin size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-400 uppercase">Delivery address</p>
                        <p className="text-sm text-gray-800 mt-1 leading-relaxed whitespace-pre-wrap">
                          {formatShippingAddress(order.shipping_address)}
                        </p>
                      </div>
                    </div>
                  </section>

                  {status === 'AWAITING_PAYMENT' && (
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-1 flex items-center gap-2">
                        <CreditCard size={14} /> Reconcile payment
                      </h4>
                      <p className="text-[11px] text-amber-800/90 mb-3">
                        Customer paid but webhook/callback missed? Enter the Paystack transaction reference.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. T1234567890"
                          className="flex-1 px-3 py-2 border border-amber-200 rounded-lg text-sm font-mono bg-white"
                          value={markPaidRef}
                          onChange={(e) => setMarkPaidRef(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={!markPaidRef.trim() || markPaidLoading}
                          onClick={markOrderPaidByReference}
                          className="bg-amber-600 text-white font-bold px-3 py-2 rounded-lg text-xs hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {markPaidLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                          Mark paid
                        </button>
                      </div>
                    </section>
                  )}

                  {isTerminal ? (
                    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h4 className="text-xs font-bold text-gray-600 uppercase mb-1">Interventions</h4>
                      <p className="text-[11px] text-gray-500">
                        This order is <span className="font-bold text-gray-800">{status}</span>. Force complete / cancel are closed.
                        {status === 'COMPLETED' ? ' Funds already released.' : ' Order already cancelled.'}
                      </p>
                    </section>
                  ) : (
                    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <h4 className="text-xs font-bold text-red-800 uppercase mb-2 flex items-center gap-2">
                        <AlertTriangle size={14} /> Intervention
                      </h4>
                      <p className="text-[11px] text-red-700/90 mb-3">
                        Overrides skip the normal buyer/seller flow. Always leave a reason — audited.
                      </p>
                      <div className="space-y-2">
                        {status !== 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={actionLoading || status === 'AWAITING_PAYMENT'}
                            title={
                              status === 'AWAITING_PAYMENT'
                                ? 'Mark paid first, or cancel if abandoned'
                                : undefined
                            }
                            onClick={() => setPendingStatus('COMPLETED')}
                            className="w-full bg-white border border-red-200 text-red-700 font-bold py-2 rounded-lg text-xs hover:bg-red-100 transition flex items-center justify-center gap-2 disabled:opacity-40"
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            Force complete (release)
                          </button>
                        )}
                        {status !== 'CANCELLED' && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setPendingStatus('CANCELLED')}
                            className="w-full bg-red-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-red-700 transition flex items-center justify-center gap-2"
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                            Force cancel (refund)
                          </button>
                        )}
                      </div>
                      {status === 'AWAITING_PAYMENT' ? (
                        <p className="mt-2 text-[10px] text-red-600">
                          Prefer Cancel for abandoned checkouts. Force complete is blocked until payment is secured.
                        </p>
                      ) : null}
                    </section>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Search} message="Enter an Order ID or Reference to begin diagnostics." />
          )}
        </>
      )}

      <ActionReasonModal
        open={pendingStatus !== null}
        title={pendingStatus === 'COMPLETED' ? 'Confirm Force Complete' : 'Confirm Force Cancel'}
        description="Provide a structured reason for this privileged intervention."
        impactSummary={
          pendingStatus === 'COMPLETED'
            ? 'Order will be marked complete and funds released to the seller.'
            : 'Order will be cancelled and buyer refunded. This cannot be undone.'
        }
        categoryOptions={[
          { value: 'fraud', label: 'Fraud risk' },
          { value: 'payment_issue', label: 'Payment issue' },
          { value: 'customer_request', label: 'Customer request' },
          { value: 'fulfillment_issue', label: 'Fulfillment issue' },
          { value: 'compliance', label: 'Compliance' },
          { value: 'other', label: 'Other' },
        ]}
        submitting={actionLoading}
        onClose={() => setPendingStatus(null)}
        onSubmit={({ category, reason }) => {
          if (!pendingStatus) return
          return forceUpdateStatus({ status: pendingStatus, category, reason })
        }}
      />
    </div>
  )
}

function partyName(party?: OrderParty | null) {
  if (!party) return '—'
  return (
    party.name ||
    party.display_name ||
    party.slug ||
    (party.email ? String(party.email).split('@')[0] : null) ||
    '—'
  )
}

function PartyCard({
  role,
  party,
  accent,
}: {
  role: string
  party?: OrderParty | null
  accent: 'buyer' | 'seller'
}) {
  const name = partyName(party)
  return (
    <div className="flex items-start gap-3">
      <div
        className={`rounded-full p-2 ${
          accent === 'buyer'
            ? 'text-[color:var(--primary)]'
            : 'bg-slate-100 text-slate-700'
        }`}
        style={
          accent === 'buyer'
            ? { backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)' }
            : undefined
        }
      >
        <User size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{role}</p>
        <p className="font-bold text-gray-900 truncate">{name}</p>
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
}: {
  icon: any
  label: string
  value: string
  mono?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Icon size={11} /> {label}
        </p>
        {onCopy ? (
          <button type="button" onClick={onCopy} className="text-gray-400 hover:text-gray-700">
            <Copy size={12} />
          </button>
        ) : null}
      </div>
      <p className={`mt-1 text-sm text-gray-900 break-all ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</p>
    </div>
  )
}

function OrderTimeline({ order }: { order: any }) {
  const status = String(order?.status || '').toUpperCase()
  const paid = PAID_LIKE.has(status) || Boolean(order?.reference)
  const shipped = Boolean(order?.shipped_at) || status === 'SHIPPED' || status === 'COMPLETED'
  const completed = status === 'COMPLETED'
  const cancelled = status === 'CANCELLED'

  if (cancelled) {
    return (
      <div className="space-y-4 relative pl-1">
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <TimelineItem icon={Package} label="Order created" date={order.created_at} state="done" />
        <TimelineItem
          icon={XCircle}
          label="Cancelled"
          date={order.updated_at}
          state="error"
          isLast
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 relative pl-1">
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
      <TimelineItem icon={Package} label="Order created" date={order.created_at} state="done" />
      <TimelineItem
        icon={CreditCard}
        label="Payment secured"
        date={paid ? order.created_at : null}
        state={paid ? 'done' : 'pending'}
        hint={!paid ? 'Awaiting Paystack' : undefined}
      />
      <TimelineItem
        icon={Truck}
        label="Shipped"
        date={order.shipped_at}
        state={order.shipped_at ? 'done' : completed ? 'skipped' : shipped ? 'done' : 'pending'}
        hint={completed && !order.shipped_at ? 'Skipped / digital' : undefined}
      />
      <TimelineItem
        icon={CheckCircle}
        label="Completed · funds released"
        date={completed ? order.updated_at : null}
        state={completed ? 'done' : 'pending'}
        isLast
      />
    </div>
  )
}

function TimelineItem({
  icon: Icon,
  label,
  date,
  state,
  hint,
  isLast,
}: {
  icon: any
  label: string
  date?: string | null
  state: 'done' | 'pending' | 'skipped' | 'error'
  hint?: string
  isLast?: boolean
}) {
  const ring =
    state === 'done'
      ? 'bg-emerald-600 border-emerald-100 text-white'
      : state === 'error'
        ? 'bg-red-600 border-red-100 text-white'
        : state === 'skipped'
          ? 'bg-gray-300 border-gray-100 text-white'
          : 'bg-white border-gray-200 text-gray-400'
  return (
    <div className={`flex gap-3 relative z-10 ${isLast ? '' : ''}`}>
      <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center border-4 ${ring}`}>
        <Icon size={13} />
      </div>
      <div className="pt-0.5 min-w-0">
        <p
          className={`text-xs font-bold ${
            state === 'done' || state === 'error' ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {label}
        </p>
        <p className="text-[11px] text-gray-500 font-mono mt-0.5">
          {date ? new Date(date).toLocaleString() : state === 'skipped' ? 'Not recorded' : 'Pending…'}
        </p>
        {hint ? <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p> : null}
      </div>
    </div>
  )
}

function StatusChip({ status, large }: { status: string; large?: boolean }) {
  const s = String(status || '').toUpperCase()
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
    PAID: 'bg-sky-50 text-sky-700 ring-sky-200',
    SHIPPED: 'bg-violet-50 text-violet-700 ring-violet-200',
    DISPUTED: 'bg-orange-50 text-orange-700 ring-orange-200',
    AWAITING_PAYMENT: 'bg-amber-50 text-amber-800 ring-amber-200',
  }
  const cls = styles[s] || 'bg-gray-50 text-gray-700 ring-gray-200'
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 font-bold ${cls} ${
        large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {s || 'UNKNOWN'}
    </span>
  )
}

function formatShippingAddress(raw: unknown): string {
  if (!raw) return '—'
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const parts = [
      o.line1 || o.address_line1 || o.street,
      o.line2 || o.address_line2,
      o.city,
      o.state || o.region,
      o.postal_code || o.zip,
      o.country,
    ]
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
    if (parts.length) return parts.join(', ')
    try {
      return JSON.stringify(raw)
    } catch {
      return '—'
    }
  }
  return String(raw)
}
