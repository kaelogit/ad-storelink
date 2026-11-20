'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, HandCoins, Landmark, Loader2 } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import { useCountryFilter } from '../../contexts/CountryFilterContext'
import { currencyForCountryCode } from '../../constants/SupportedCountries'
import { formatMoney } from './charts/format'
import { roleCanOpenPath } from '../../constants/adminNavigation'
import { useAdminRole } from '../../hooks/useAdminRole'
import { ActionFeedback } from './ActionFeedback'
import { StatusBadge } from './StatusBadge'

type FinanceOverview = {
  escrow_balance?: number
  pending_payouts?: number
  payout_count?: number
}

type EscrowHealthPanelProps = {
  compact?: boolean
}

export function EscrowHealthPanel({ compact = false }: EscrowHealthPanelProps) {
  const supabase = useMemo(() => createClient(), [])
  const { role } = useAdminRole()
  const { countryCode, isGlobalView } = useCountryFilter()
  const currency = currencyForCountryCode(isGlobalView ? 'NG' : countryCode)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [finance, setFinance] = useState<FinanceOverview>({})
  const [productDisputes, setProductDisputes] = useState(0)
  const [serviceDisputes, setServiceDisputes] = useState(0)
  const [depositBalanceDue, setDepositBalanceDue] = useState(0)
  const [partialRefunds, setPartialRefunds] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [financeRes, productRes, serviceRes, depositDueRes, partialRes] = await Promise.all([
          supabase.rpc('get_finance_overview'),
          supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase
            .from('service_orders')
            .select('id', { count: 'exact', head: true })
            .in('dispute_state', ['under_review', 'open', 'disputed']),
          supabase
            .from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('payment_state', 'deposit_paid')
            .eq('status', 'confirmed'),
          supabase
            .from('service_orders')
            .select('id', { count: 'exact', head: true })
            .eq('payment_state', 'partially_refunded'),
        ])

        if (cancelled) return

        const failed = [financeRes, productRes, serviceRes, depositDueRes, partialRes].find(
          (res) => res.error,
        )
        if (failed?.error) {
          setLoadError(failed.error.message || 'Could not load escrow health.')
        }

        setFinance((financeRes.data as FinanceOverview) ?? {})
        setProductDisputes(productRes.count ?? 0)
        setServiceDisputes(serviceRes.count ?? 0)
        setDepositBalanceDue(depositDueRes.count ?? 0)
        setPartialRefunds(partialRes.count ?? 0)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load escrow health.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const totalDisputes = productDisputes + serviceDisputes
  const hasRisk =
    totalDisputes > 0 ||
    Number(finance.pending_payouts ?? 0) > 0 ||
    depositBalanceDue > 0 ||
    partialRefunds > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-10 text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading escrow health…
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        hasRisk ? 'border-amber-300' : 'border-zinc-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Escrow & payout health</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Live snapshot from finance overview and open dispute queues.
          </p>
        </div>
        <StatusBadge
          label={hasRisk ? 'Needs attention' : 'Clear'}
          tone={hasRisk ? 'warning' : 'success'}
        />
      </div>

      <div className="mt-4 space-y-3">
        {loadError ? <ActionFeedback tone="error" message={loadError} /> : null}
        <dl className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
          <Metric
            label="Escrow balance"
            value={isGlobalView ? '—' : formatMoney(finance.escrow_balance, currency)}
          />
          <Metric
            label="Pending payouts"
            value={isGlobalView ? '—' : formatMoney(finance.pending_payouts, currency)}
          />
          <Metric label="Payout queue" value={`${finance.payout_count ?? 0} items`} />
          <Metric
            label="Open disputes"
            value={`${totalDisputes}`}
            hint={`${productDisputes} product · ${serviceDisputes} service`}
            warn={totalDisputes > 0}
          />
          <Metric label="Deposit · balance due" value={`${depositBalanceDue}`} warn={depositBalanceDue > 0} />
          <Metric label="Partial refunds" value={`${partialRefunds}`} warn={partialRefunds > 0} />
        </dl>

        {!compact ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {roleCanOpenPath(role, '/dashboard/finance') ? (
              <DeskLink href="/dashboard/finance" icon={<Landmark className="h-3.5 w-3.5" />}>
                Finance center
              </DeskLink>
            ) : null}
            {roleCanOpenPath(role, '/dashboard/bookings') ? (
              <DeskLink href="/dashboard/bookings">Service bookings</DeskLink>
            ) : null}
            {roleCanOpenPath(role, '/dashboard/clawback-debts') ? (
              <DeskLink href="/dashboard/clawback-debts" icon={<HandCoins className="h-3.5 w-3.5" />}>
                Clawback debts
              </DeskLink>
            ) : null}
            {roleCanOpenPath(role, '/dashboard/payment-incidents') ? (
              <DeskLink href="/dashboard/payment-incidents">Payment incidents</DeskLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${warn ? 'text-amber-800' : 'text-zinc-900'}`}>
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  )
}

function DeskLink({
  href,
  children,
  icon,
}: {
  href: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
    >
      {icon}
      {children}
      <ArrowRight className="h-3 w-3 opacity-50" />
    </Link>
  )
}
