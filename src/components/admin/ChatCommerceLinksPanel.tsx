'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RefreshCcw, ShoppingBag, Wrench } from 'lucide-react'

import { parseApiError } from '../../utils/http'

type ProductOrderLink = {
  id: string
  entity_type: 'product_order'
  status: string
  total_amount?: number | null
  currency_code?: string | null
  title?: string | null
  line_count?: number | null
  is_active?: boolean
  has_dispute?: boolean
  updated_at?: string | null
}

type ServiceBookingLink = {
  id: string
  entity_type: 'service_booking'
  status: string
  amount_minor?: number | null
  currency_code?: string | null
  title?: string | null
  linked_order_id?: string | null
  is_active?: boolean
  has_dispute?: boolean
  updated_at?: string | null
}

type CommerceLinksPayload = {
  chatId?: string
  buyerId?: string
  sellerId?: string
  inThread?: {
    productOrders?: ProductOrderLink[]
    serviceBookings?: ServiceBookingLink[]
  }
  pairHistory?: {
    productOrders?: ProductOrderLink[]
    serviceBookings?: ServiceBookingLink[]
  } | null
}

type ChatCommerceLinksPanelProps = {
  chatId: string
  title?: string
  description?: string
  includePairHistory?: boolean
  compact?: boolean
  onLoaded?: (payload: CommerceLinksPayload) => void
}

function statusChipClass(active?: boolean, dispute?: boolean) {
  if (dispute) return 'bg-orange-100 text-orange-800'
  if (active) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-700'
}

export function ChatCommerceLinksPanel({
  chatId,
  title = 'Linked orders & bookings',
  description = 'Commerce in this chat thread. Loads are audit-logged.',
  includePairHistory = false,
  compact = false,
  onLoaded,
}: ChatCommerceLinksPanelProps) {
  const [payload, setPayload] = useState<CommerceLinksPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!chatId.trim()) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ chatId: chatId.trim() })
    if (includePairHistory) params.set('includePairHistory', '1')

    const response = await fetch(`/api/admin/chats/commerce-links?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Could not load chat commerce links.')
      setError(msg)
      setPayload(null)
      setLoading(false)
      return
    }

    const data = (await response.json()) as CommerceLinksPayload
    setPayload(data)
    onLoaded?.(data)
    setLoading(false)
  }, [chatId, includePairHistory, onLoaded])

  useEffect(() => {
    void load()
  }, [load])

  const inThreadOrders = payload?.inThread?.productOrders ?? []
  const inThreadBookings = payload?.inThread?.serviceBookings ?? []
  const pairOrders = payload?.pairHistory?.productOrders ?? []
  const pairBookings = payload?.pairHistory?.serviceBookings ?? []
  const totalCount = inThreadOrders.length + inThreadBookings.length + pairOrders.length + pairBookings.length

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`font-bold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h3>
          {!compact && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/chats?chatId=${encodeURIComponent(chatId)}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            P2P viewer
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

      {loading && !payload ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading linked commerce…
        </div>
      ) : totalCount === 0 ? (
        <p className="text-xs text-gray-500">No orders or bookings linked to this chat thread.</p>
      ) : (
        <div className="space-y-4">
          <CommerceGroup
            label="In this chat"
            orders={inThreadOrders}
            bookings={inThreadBookings}
            compact={compact}
          />
          {includePairHistory && (pairOrders.length > 0 || pairBookings.length > 0) ? (
            <CommerceGroup
              label="Other threads (same buyer ↔ seller)"
              orders={pairOrders}
              bookings={pairBookings}
              compact={compact}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

function CommerceGroup({
  label,
  orders,
  bookings,
  compact,
}: {
  label: string
  orders: ProductOrderLink[]
  bookings: ServiceBookingLink[]
  compact?: boolean
}) {
  if (orders.length === 0 && bookings.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className={`rounded-lg border border-gray-100 bg-gray-50 ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <ShoppingBag className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{order.title || 'Product order'}</span>
                </div>
                <p className="text-[10px] font-mono text-gray-500 mt-0.5 break-all">{order.id}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${statusChipClass(order.is_active, order.has_dispute)}`}
              >
                {order.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              {order.currency_code != null && order.total_amount != null ? (
                <span className="font-mono text-gray-700">
                  {order.currency_code} {Number(order.total_amount).toLocaleString()}
                </span>
              ) : null}
              <Link href={`/dashboard/orders?q=${order.id}`} className="font-semibold text-blue-600 hover:underline">
                Open in Transaction Ops
              </Link>
            </div>
          </div>
        ))}

        {bookings.map((booking) => (
          <div
            key={booking.id}
            className={`rounded-lg border border-gray-100 bg-gray-50 ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <Wrench className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{booking.title || 'Service booking'}</span>
                </div>
                <p className="text-[10px] font-mono text-gray-500 mt-0.5 break-all">{booking.id}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${statusChipClass(booking.is_active, booking.has_dispute)}`}
              >
                {booking.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              {booking.currency_code != null && booking.amount_minor != null ? (
                <span className="font-mono text-gray-700">
                  {booking.currency_code} {(Number(booking.amount_minor) / 100).toLocaleString()}
                </span>
              ) : null}
              <Link href={`/dashboard/bookings?q=${booking.id}`} className="font-semibold text-blue-600 hover:underline">
                Open booking
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { CommerceLinksPayload, ProductOrderLink, ServiceBookingLink }
