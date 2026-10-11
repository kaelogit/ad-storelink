'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Siren } from 'lucide-react'
import { DISASTER_RUNBOOKS } from '../../constants/disasterRunbooks'

function severityClass(sev: string) {
  if (sev === 'SEV-1') return 'bg-red-100 text-red-800 border-red-200'
  if (sev === 'SEV-2') return 'bg-amber-100 text-amber-900 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

type IncidentSummary = {
  awaitingPaymentCount?: number
  thresholdBreached?: boolean
  openIncidentCount?: number
}

/**
 * Overview disaster recovery — static runbooks, collapsed unless live signals fire.
 * These cards are NOT live outages; they are playbooks.
 */
export function DisasterRecoveryPanel() {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<IncidentSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/payment-incidents/desk?limit=1')
        if (!res.ok) return
        const data = await res.json()
        const s = (data?.summary || data || {}) as Record<string, unknown>
        const next: IncidentSummary = {
          awaitingPaymentCount: Number(
            s.awaiting_payment_count ?? s.awaitingPaymentCount ?? s.stuck_count ?? 0,
          ),
          thresholdBreached: Boolean(s.threshold_breached ?? s.thresholdBreached),
          openIncidentCount: Number(s.open_incident_count ?? s.openIncidentCount ?? 0),
        }
        if (!cancelled) {
          setSummary(next)
          if (
            next.thresholdBreached ||
            (next.awaitingPaymentCount ?? 0) > 0 ||
            (next.openIncidentCount ?? 0) > 0
          ) {
            setOpen(true)
          }
        }
      } catch {
        // keep collapsed; runbooks remain available on demand
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const live =
    summary?.thresholdBreached ||
    (summary?.awaitingPaymentCount ?? 0) > 0 ||
    (summary?.openIncidentCount ?? 0) > 0

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-2">
          <Siren className={`mt-0.5 h-5 w-5 shrink-0 ${live ? 'text-red-600' : 'text-gray-400'}`} />
          <div>
            <h3 className="text-sm font-black text-gray-900">Disaster recovery runbooks</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {live
                ? 'Payment signals look elevated — open a playbook if you are actively remediating.'
                : 'Not a live alert. Collapsed playbooks for Paystack / webhook / payout failures.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              live
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            {live ? 'Signals present' : 'All clear · docs only'}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {open ? (
        <div className="grid gap-3 md:grid-cols-3 pt-1">
          {DISASTER_RUNBOOKS.map((rb) => (
            <div
              key={rb.id}
              id={`dr-${rb.id}`}
              className="rounded-lg border border-gray-200 bg-gray-50/80 p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-gray-900 leading-snug">{rb.title}</p>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black tracking-wide ${severityClass(rb.severity)}`}
                >
                  {rb.severity}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{rb.summary}</p>
              <ul className="space-y-1">
                {rb.steps.slice(0, 3).map((step) => (
                  <li key={step} className="flex gap-1.5 text-[10px] text-gray-700">
                    <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-500" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Link
                  href={rb.primaryHref}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-black"
                >
                  {rb.primaryLabel}
                  <ExternalLink className="h-3 w-3 opacity-80" />
                </Link>
                {rb.secondaryLinks?.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="text-[9px] text-gray-400 font-mono truncate" title={rb.repoPath}>
                {rb.repoPath}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
