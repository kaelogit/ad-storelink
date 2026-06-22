'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  Package,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react'
import { StatusBadge } from './StatusBadge'

type ChartPoint = { label: string; value: number }

type SellerOrderRow = {
  id: string
  total_amount?: number
  currency_code?: string
  status?: string
  payout_status?: string | null
  created_at?: string
}

type PayoutLedgerRow = {
  kind?: string
  sort_at?: string
  amount?: number
  currency_code?: string
  title?: string
  subtitle?: string
  badge?: string
  route?: { type?: string; id?: string }
}

export type SellerAnalyticsSnapshot = {
  is_seller?: boolean
  user_id?: string
  display_name?: string | null
  seller_type?: string | null
  currency_code?: string
  as_of?: string
  dashboard?: {
    lifetime_revenue?: number
    product_revenue?: number
    service_revenue?: number
    product_listings?: number
    service_listings?: number
    total_listings?: number
    active_product_orders?: number
    active_service_bookings?: number
    profile_views_7d?: number
  }
  revenue?: {
    total_revenue?: number
    total_orders?: number
    total_paid_out?: number
    clearing_amount?: number
    avg_sale?: number
    product_gmv?: number
    service_gmv?: number
    chart_data?: ChartPoint[]
  }
  recent_orders?: SellerOrderRow[]
  payout_ledger?: PayoutLedgerRow[]
}

type UserSellerAnalyticsPanelProps = {
  userId: string
  snapshot: SellerAnalyticsSnapshot | null
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function UserSellerAnalyticsPanel({ snapshot }: UserSellerAnalyticsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const chart = useMemo(() => {
    const raw = snapshot?.revenue?.chart_data ?? []
    const points = raw.map((d) => ({ label: d.label ?? '', value: Number(d.value) || 0 }))
    const max = Math.max(...points.map((p) => p.value), 1)
    return { points, max }
  }, [snapshot?.revenue?.chart_data])

  if (!snapshot?.is_seller) return null

  const currency = snapshot.currency_code || 'NGN'
  const dash = snapshot.dashboard ?? {}
  const rev = snapshot.revenue ?? {}
  const sellerType = (snapshot.seller_type || 'product').toLowerCase()
  const showsMix = sellerType === 'both'
  const mixTotal = (rev.product_gmv ?? 0) + (rev.service_gmv ?? 0)
  const productMixPct = mixTotal > 0 ? Math.round(((rev.product_gmv ?? 0) / mixTotal) * 100) : null

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <BarChart3 size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Seller analytics</p>
            <p className="text-sm font-black text-gray-900">
              {formatMoney(Number(dash.lifetime_revenue ?? 0), currency)} lifetime
            </p>
          </div>
        </div>
        <StatusBadge label={sellerType.toUpperCase()} tone="info" />
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard icon={Eye} label="Store views (7d)" value={String(dash.profile_views_7d ?? 0)} />
          <KpiCard icon={ShoppingBag} label="Active orders" value={String(dash.active_product_orders ?? 0)} />
          <KpiCard icon={CalendarCheck} label="Active bookings" value={String(dash.active_service_bookings ?? 0)} />
          <KpiCard icon={Store} label="Listings" value={String(dash.total_listings ?? 0)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400">Paid out</p>
            <p className="text-xs font-bold text-emerald-700 mt-1">{formatMoney(Number(rev.total_paid_out ?? 0), currency)}</p>
          </div>
          <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400">Processing</p>
            <p className="text-xs font-bold text-amber-700 mt-1">{formatMoney(Number(rev.clearing_amount ?? 0), currency)}</p>
          </div>
        </div>

        {showsMix && mixTotal > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-2">Revenue mix</p>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
              <div className="bg-indigo-500" style={{ width: `${productMixPct ?? 0}%` }} />
              <div className="bg-violet-400 flex-1" />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Product {productMixPct}% · Service {100 - (productMixPct ?? 0)}%
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left hover:bg-indigo-100 transition"
        >
          <span className="text-xs font-bold text-indigo-900">Full seller snapshot</span>
          {expanded ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />}
        </button>

        {expanded ? (
          <div className="space-y-4 border-t border-indigo-100 pt-4">
            <div>
              <p className="text-[9px] font-bold uppercase text-gray-400 mb-2">6-month revenue</p>
              <div className="flex items-end gap-1.5 h-24 rounded-lg border border-gray-100 bg-white p-3">
                {chart.points.map((p) => (
                  <div key={p.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-full max-w-[28px] rounded-t bg-indigo-500/80"
                      style={{ height: `${Math.max(4, (p.value / chart.max) * 72)}px` }}
                      title={`${p.label}: ${p.value}`}
                    />
                    <span className="text-[8px] text-gray-400 truncate w-full text-center">{p.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                {Number(rev.total_orders ?? 0).toLocaleString()} completed sales · avg{' '}
                {formatMoney(Number(rev.avg_sale ?? 0), currency)}
              </p>
            </div>

            {(snapshot.recent_orders?.length ?? 0) > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
                  <Package size={11} /> Recent seller orders
                </p>
                {snapshot.recent_orders?.map((o) => (
                  <div key={o.id} className="flex justify-between gap-2 text-[10px] border-b border-gray-50 pb-1.5 last:border-0">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-gray-800">#{o.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-gray-400">{o.status} · payout {o.payout_status || '—'}</p>
                    </div>
                    <p className="font-bold text-gray-900 shrink-0">
                      {formatMoney(Number(o.total_amount ?? 0), o.currency_code || currency)}
                    </p>
                  </div>
                ))}
                <Link href="/dashboard/orders" className="text-[10px] font-bold text-blue-600 hover:underline">
                  Open Transaction Ops →
                </Link>
              </div>
            ) : null}

            {(snapshot.payout_ledger?.length ?? 0) > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 max-h-44 overflow-y-auto">
                <p className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
                  <Wallet size={11} /> Payout ledger
                </p>
                {snapshot.payout_ledger?.map((row, idx) => (
                  <div key={`${row.kind}-${idx}`} className="flex justify-between gap-2 text-[10px] border-b border-gray-50 pb-1.5 last:border-0">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800">{row.title}</p>
                      <p className="text-gray-400 truncate">{row.subtitle}</p>
                      {row.route?.type === 'booking' && row.route.id ? (
                        <Link href={`/dashboard/bookings`} className="text-blue-600 hover:underline">
                          Booking desk
                        </Link>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-700">
                        +{formatMoney(Number(row.amount ?? 0), row.currency_code || currency)}
                      </p>
                      <p className="text-gray-400">{row.badge}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/bookings`}
                className="text-[10px] font-bold rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              >
                Bookings desk
              </Link>
              <Link
                href={`/dashboard/clawback-debts`}
                className="text-[10px] font-bold rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              >
                Clawback debts
              </Link>
            </div>

            {snapshot.as_of ? (
              <p className="text-[9px] text-gray-400">
                Snapshot as of {new Date(snapshot.as_of).toLocaleString()} · read-only (mirrors seller Sales Dashboard + Revenue)
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
      <p className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
        <Icon size={10} className="text-indigo-500" /> {label}
      </p>
      <p className="text-sm font-black text-gray-900 mt-1">{value}</p>
    </div>
  )
}
