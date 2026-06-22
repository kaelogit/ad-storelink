'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  HandCoins,
  Scale,
  Wallet,
} from 'lucide-react'
import { formatServiceDisputeReason } from '../../lib/serviceDisputeReasons'

type TimelineStep = {
  key?: string
  label?: string
  at?: string | null
  state?: 'done' | 'inferred' | 'current' | string
  status?: string
  note?: string
  reason?: string
  payment_reference?: string | null
}

type PayoutLeg = {
  id?: string
  phase?: string
  leg?: string
  amount_minor?: number
  currency_code?: string
  payout_status?: string
  status?: string
  payout_reference?: string | null
  payout_retry_count?: number
  payout_error_log?: string | null
  eligible_at?: string | null
  updated_at?: string | null
}

type ClawbackDebt = {
  id?: string
  status?: string
  amount_minor?: number
  currency_code?: string
  reason?: string | null
  admin_note?: string | null
  paid_reference?: string | null
  paid_at?: string | null
  created_at?: string | null
}

type PolicyRef = {
  label?: string
  href?: string
  description?: string
}

export type BookingTimelinePayload = {
  service_order_id?: string
  current_status?: string
  steps?: TimelineStep[]
  escrow?: {
    amount_minor_total?: number
    amount_minor_held?: number
    amount_minor_released_start?: number
    amount_minor_released_complete?: number
    currency_code?: string
    released_at_start?: string | null
    released_at_complete?: string | null
  }
  linked_order?: {
    order_id?: string
    status?: string
    payment_reference?: string | null
    paid_at?: string | null
  } | null
  payout_legs?: PayoutLeg[]
  clawback_debts?: ClawbackDebt[]
  dispute?: {
    state?: string
    reason?: string | null
    note?: string | null
    metadata?: Record<string, unknown> | null
    flagged_at?: string | null
  }
  admin_interventions?: Array<{ action_type?: string; created_at?: string; details?: unknown }>
  policy_refs?: PolicyRef[]
}

function formatMinor(amountMinor: number | undefined, currency: string) {
  const code = (currency || 'NGN').toUpperCase()
  const decimals = ['XOF', 'RWF'].includes(code) ? 0 : 2
  return `${code} ${(Number(amountMinor || 0) / Math.pow(10, decimals)).toLocaleString()}`
}

function stepIcon(state?: string) {
  if (state === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
  if (state === 'current') return <Clock className="h-4 w-4 text-blue-600 shrink-0" />
  if (state === 'inferred') return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
  return <Circle className="h-4 w-4 text-gray-300 shrink-0" />
}

export function ServiceBookingTimelinePanel({
  payload,
  currencyCode,
}: {
  payload: BookingTimelinePayload | null | undefined
  currencyCode: string
}) {
  if (!payload) return null

  const escrow = payload.escrow ?? {}
  const currency = escrow.currency_code || currencyCode || 'NGN'
  const total = Number(escrow.amount_minor_total ?? 0)
  const releasedStart = Number(escrow.amount_minor_released_start ?? 0)
  const releasedComplete = Number(escrow.amount_minor_released_complete ?? 0)
  const held = Number(escrow.amount_minor_held ?? 0)
  const startPct = total > 0 ? Math.round((releasedStart / total) * 100) : 0
  const completePct = total > 0 ? Math.round((releasedComplete / total) * 100) : 0
  const heldPct = total > 0 ? Math.round((held / total) * 100) : 100

  const dispute = payload.dispute
  const steps = payload.steps ?? []
  const payoutLegs = payload.payout_legs ?? []
  const clawbacks = payload.clawback_debts ?? []
  const policies = payload.policy_refs ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Scale className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-bold text-gray-900">Booking timeline & escrow</h3>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Status journey</p>
          <ol className="space-y-3 border-l-2 border-slate-200 ml-2 pl-4">
            {steps.map((step, idx) => (
              <li key={`${step.key}-${idx}`} className="relative">
                <div className="absolute -left-[1.35rem] top-0.5 bg-white rounded-full">{stepIcon(step.state)}</div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">{step.label}</p>
                  {step.at ? (
                    <p className="text-[10px] text-gray-500">{new Date(step.at).toLocaleString()}</p>
                  ) : step.state === 'inferred' ? (
                    <p className="text-[10px] text-amber-700">{step.note || 'Timestamp not recorded'}</p>
                  ) : null}
                  {step.reason ? (
                    <p className="text-[10px] text-orange-800 mt-0.5">
                      Reason: {formatServiceDisputeReason(step.reason) || step.reason}
                    </p>
                  ) : null}
                  {step.payment_reference ? (
                    <p className="text-[10px] font-mono text-gray-600 mt-0.5">Ref: {step.payment_reference}</p>
                  ) : null}
                  {step.status ? (
                    <p className="text-[10px] font-bold uppercase text-blue-700 mt-0.5">{step.status}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-500" />
            <p className="text-xs font-bold text-gray-900">30 / 70 escrow legs</p>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
            {startPct > 0 ? <div className="bg-emerald-500" style={{ width: `${startPct}%` }} title="30% leg" /> : null}
            {completePct > 0 ? <div className="bg-blue-500" style={{ width: `${completePct}%` }} title="70% leg" /> : null}
            {heldPct > 0 && startPct + completePct < 100 ? (
              <div className="bg-amber-300 flex-1" title="Held in vault" />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-gray-500">Total</span>
              <p className="font-mono font-bold">{formatMinor(total, currency)}</p>
            </div>
            <div>
              <span className="text-gray-500">Held</span>
              <p className="font-mono font-bold text-amber-800">{formatMinor(held, currency)}</p>
            </div>
            <div>
              <span className="text-gray-500">Released 30%</span>
              <p className="font-mono font-bold text-emerald-700">{formatMinor(releasedStart, currency)}</p>
            </div>
            <div>
              <span className="text-gray-500">Released 70%</span>
              <p className="font-mono font-bold text-blue-700">{formatMinor(releasedComplete, currency)}</p>
            </div>
          </div>
          {payload.linked_order?.order_id ? (
            <Link
              href={`/dashboard/orders?q=${encodeURIComponent(payload.linked_order.order_id)}`}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
            >
              Linked order {payload.linked_order.order_id.slice(0, 8)}… ({payload.linked_order.status})
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>

        {payoutLegs.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-gray-400">Payout processor legs</p>
            {payoutLegs.map((leg) => (
              <div key={leg.id} className="flex flex-wrap justify-between gap-2 text-[10px] border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <span className="font-bold text-gray-800 uppercase">{leg.phase || leg.leg}</span>
                  <span className="text-gray-400 ml-1">· {leg.payout_status || leg.status}</span>
                  {leg.payout_reference ? (
                    <p className="font-mono text-gray-500 mt-0.5">{leg.payout_reference}</p>
                  ) : null}
                  {leg.payout_error_log ? (
                    <p className="text-red-700 mt-0.5 truncate max-w-[240px]" title={leg.payout_error_log}>
                      {leg.payout_error_log}
                    </p>
                  ) : null}
                </div>
                <p className="font-mono font-bold shrink-0">{formatMinor(leg.amount_minor, leg.currency_code || currency)}</p>
              </div>
            ))}
          </div>
        ) : null}

        {dispute && dispute.state && dispute.state !== 'none' ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-800" />
              <p className="text-xs font-bold text-orange-950">Dispute · {dispute.state}</p>
            </div>
            {dispute.reason ? (
              <p className="text-[11px] text-orange-900">
                <span className="font-semibold">Reason:</span> {formatServiceDisputeReason(dispute.reason) || dispute.reason}
              </p>
            ) : null}
            {dispute.note ? <p className="text-[11px] text-orange-900"><span className="font-semibold">Note:</span> {dispute.note}</p> : null}
            {Array.isArray((dispute.metadata as { dispute_claim?: { evidence_urls?: unknown } } | null)?.dispute_claim?.evidence_urls) &&
            ((dispute.metadata as { dispute_claim?: { evidence_urls?: string[] } }).dispute_claim?.evidence_urls?.length ?? 0) > 0 ? (
              <div className="text-[10px] text-orange-900 space-y-1">
                <p className="font-semibold">Evidence</p>
                {((dispute.metadata as { dispute_claim?: { evidence_urls?: string[] } }).dispute_claim?.evidence_urls || []).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate text-blue-700 underline">
                    {url}
                  </a>
                ))}
              </div>
            ) : null}
            {dispute.flagged_at ? (
              <p className="text-[10px] text-orange-800">Flagged {new Date(dispute.flagged_at).toLocaleString()}</p>
            ) : null}
            {dispute.metadata && Object.keys(dispute.metadata).length > 0 ? (
              <pre className="text-[9px] bg-white/80 border border-orange-100 rounded p-2 overflow-x-auto max-h-28 text-orange-950">
                {JSON.stringify(dispute.metadata, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}

        {clawbacks.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-red-800" />
              <p className="text-xs font-bold text-red-950">Seller clawback</p>
            </div>
            {clawbacks.map((debt) => (
              <div key={debt.id} className="text-[10px] text-red-900 border-b border-red-100 pb-2 last:border-0">
                <p className="font-mono font-bold">
                  {formatMinor(debt.amount_minor, debt.currency_code || currency)} · {debt.status}
                </p>
                {debt.reason ? <p className="mt-0.5">{debt.reason}</p> : null}
                {debt.id ? (
                  <Link href="/dashboard/clawback-debts" className="inline-flex items-center gap-1 font-bold text-red-800 hover:underline mt-1">
                    Open clawback desk
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {policies.length > 0 ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-blue-800">Policy references</p>
            {policies.map((ref) => {
              const isExternal = ref.href?.startsWith('http')
              const className = 'block rounded-md border border-blue-100 bg-white px-2.5 py-2 hover:bg-blue-50/80 transition'
              const inner = (
                <>
                  <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    {ref.label}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                  {ref.description ? <span className="text-[10px] text-blue-800/80 block mt-0.5">{ref.description}</span> : null}
                </>
              )
              return isExternal ? (
                <a key={ref.href} href={ref.href} target="_blank" rel="noreferrer" className={className}>
                  {inner}
                </a>
              ) : (
                <Link key={ref.href} href={ref.href || '#'} className={className}>
                  {inner}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
