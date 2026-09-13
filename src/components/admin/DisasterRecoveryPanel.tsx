'use client'

import Link from 'next/link'
import { AlertTriangle, ExternalLink, Siren } from 'lucide-react'
import { DISASTER_RUNBOOKS } from '../../constants/disasterRunbooks'

function severityClass(sev: string) {
  if (sev === 'SEV-1') return 'bg-red-100 text-red-800 border-red-200'
  if (sev === 'SEV-2') return 'bg-amber-100 text-amber-900 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

/** Overview disaster recovery cards — one-click desks (#106). */
export function DisasterRecoveryPanel() {
  return (
    <section className="rounded-xl border border-red-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Siren className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="text-sm font-black text-gray-900">Disaster recovery</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Paystack failure, webhook down, mass payout stuck — open the desk, follow the steps.
            </p>
          </div>
        </div>
        <p className="text-[10px] font-mono text-gray-400">docs/DISASTER_RECOVERY_RUNBOOK.md</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-red-700"
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
    </section>
  )
}
