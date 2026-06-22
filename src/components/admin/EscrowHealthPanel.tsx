'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, HandCoins, Landmark, Loader2 } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import { Card, CardContent, CardHeader } from '../ui'

type FinanceOverview = {
  escrow_balance?: number
  pending_payouts?: number
  payout_count?: number
}

type EscrowHealthPanelProps = {
  compact?: boolean
}

export function EscrowHealthPanel({ compact = false }: EscrowHealthPanelProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [finance, setFinance] = useState<FinanceOverview>({})
  const [productDisputes, setProductDisputes] = useState(0)
  const [serviceDisputes, setServiceDisputes] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [financeRes, productRes, serviceRes] = await Promise.all([
        supabase.rpc('get_finance_overview'),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase
          .from('service_orders')
          .select('id', { count: 'exact', head: true })
          .in('dispute_state', ['under_review', 'open', 'disputed']),
      ])

      if (cancelled) return

      setFinance((financeRes.data as FinanceOverview) ?? {})
      setProductDisputes(productRes.count ?? 0)
      setServiceDisputes(serviceRes.count ?? 0)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const totalDisputes = productDisputes + serviceDisputes
  const hasRisk = totalDisputes > 0 || Number(finance.pending_payouts ?? 0) > 0

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-[var(--muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading escrow health…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={hasRisk ? 'border-amber-200' : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Escrow & payout health</p>
            <p className="text-sm text-[var(--muted)]">
              Live snapshot from finance overview and open dispute queues.
            </p>
          </div>
          {hasRisk && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs attention
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className={`grid gap-4 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'} text-sm`}>
          <div>
            <dt className="text-[var(--muted)]">Escrow balance</dt>
            <dd className="font-semibold">{formatMoney(finance.escrow_balance)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Pending payouts</dt>
            <dd className="font-semibold">{formatMoney(finance.pending_payouts)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Payout queue</dt>
            <dd className="font-semibold">{finance.payout_count ?? 0} items</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Open disputes</dt>
            <dd className={`font-semibold ${totalDisputes > 0 ? 'text-red-600' : ''}`}>
              {totalDisputes}{' '}
              <span className="text-xs font-normal text-[var(--muted)]">
                ({productDisputes} product · {serviceDisputes} service)
              </span>
            </dd>
          </div>
        </dl>

        {!compact && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/dashboard/finance"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Landmark className="h-3.5 w-3.5" />
              Finance center
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Service bookings
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/dashboard/clawback-debts"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <HandCoins className="h-3.5 w-3.5" />
              Clawback debts
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/dashboard/payment-incidents"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Payment incidents
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatMoney(value: number | undefined | null) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
