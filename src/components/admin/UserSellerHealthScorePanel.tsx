'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  HeartPulse,
  ShieldAlert,
  Zap,
} from 'lucide-react'

import { StatusBadge } from './StatusBadge'

export type SellerHealthScorePayload = {
  isSeller?: boolean
  userId?: string
  asOf?: string
  healthScore?: number | null
  grade?: 'healthy' | 'watch' | 'review' | 'n/a'
  autoReviewRecommended?: boolean
  autoReviewReasons?: Array<{ code?: string; label?: string }>
  metrics?: {
    completedOrders?: number
    disputeCount?: number
    disputeRatePct?: number
    reputationScore?: number | null
    chargebackCount?: number
    clawbackDebtCount?: number
    chargebackVerdictCount?: number
    contentStrikes?: number
    trustRiskScore?: number
    medianResponseMinutes?: number | null
    responseSamples?: number
    responseLookbackDays?: number
  }
  penalties?: {
    chargeback?: number
    contentStrikes?: number
    responseTime?: number
  }
  recentStrikes?: Array<{
    event_type?: string
    scope?: string | null
    points?: number
    created_at?: string
    metadata?: Record<string, unknown> | null
  }>
  config?: {
    autoReviewScoreThreshold?: number
    autoReviewDisputeRatePct?: number
    autoReviewChargebackCount?: number
    autoReviewContentStrikes?: number
    autoReviewMedianResponseMinutes?: number
    responseLookbackDays?: number
    notes?: string | null
  }
}

type UserSellerHealthScorePanelProps = {
  payload: SellerHealthScorePayload | null
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—'
  const m = Number(minutes)
  if (m < 60) return `${Math.round(m)} min`
  if (m < 1440) return `${(m / 60).toFixed(1)} hr`
  return `${(m / 1440).toFixed(1)} d`
}

function gradeTone(grade?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (grade === 'healthy') return 'success'
  if (grade === 'watch') return 'warning'
  if (grade === 'review') return 'danger'
  return 'neutral'
}

export function UserSellerHealthScorePanel({ payload }: UserSellerHealthScorePanelProps) {
  const [expanded, setExpanded] = useState(false)

  const scoreRingStyle = useMemo(() => {
    const score = payload?.healthScore ?? 0
    const pct = Math.max(0, Math.min(100, score))
    return {
      background: `conic-gradient(#6366f1 ${pct * 3.6}deg, #e5e7eb 0deg)`,
    }
  }, [payload?.healthScore])

  if (!payload?.isSeller) return null

  const metrics = payload.metrics ?? {}
  const penalties = payload.penalties ?? {}
  const cfg = payload.config ?? {}
  const reasons = payload.autoReviewReasons ?? []

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-violet-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full p-[3px] shrink-0"
            style={scoreRingStyle}
            aria-label={`Health score ${payload.healthScore ?? 0}`}
          >
            <div className="h-full w-full rounded-full bg-white flex flex-col items-center justify-center">
              <span className="text-sm font-black text-gray-900">{payload.healthScore ?? '—'}</span>
              <span className="text-[8px] font-bold uppercase text-gray-400">/100</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
              <HeartPulse size={12} /> Seller health
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge label={(payload.grade ?? 'n/a').toUpperCase()} tone={gradeTone(payload.grade)} />
              {payload.autoReviewRecommended ? (
                <StatusBadge label="AUTO-REVIEW" tone="danger" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {payload.autoReviewRecommended && reasons.length > 0 ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-amber-950">Auto-review recommended</p>
            <ul className="mt-1 space-y-0.5">
              {reasons.map((r) => (
                <li key={r.code ?? r.label} className="text-[10px] text-amber-900">
                  · {r.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            icon={Gavel}
            label="Dispute rate"
            value={`${Number(metrics.disputeRatePct ?? 0).toFixed(1)}%`}
            sub={`${metrics.disputeCount ?? 0} / ${metrics.completedOrders ?? 0} completed`}
          />
          <MetricCard
            icon={ShieldAlert}
            label="Chargebacks"
            value={String(metrics.chargebackCount ?? 0)}
            sub={`${metrics.clawbackDebtCount ?? 0} clawback · ${metrics.chargebackVerdictCount ?? 0} verdicts`}
          />
          <MetricCard
            icon={Zap}
            label="Content strikes"
            value={String(metrics.contentStrikes ?? 0)}
            sub={`Trust risk ${metrics.trustRiskScore ?? 0}`}
          />
          <MetricCard
            icon={Clock}
            label="Median response"
            value={formatMinutes(metrics.medianResponseMinutes)}
            sub={`${metrics.responseSamples ?? 0} samples · ${metrics.responseLookbackDays ?? 90}d`}
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-left hover:bg-violet-100 transition"
        >
          <span className="text-xs font-bold text-violet-900">Score breakdown & thresholds</span>
          {expanded ? <ChevronUp size={14} className="text-violet-600" /> : <ChevronDown size={14} className="text-violet-600" />}
        </button>

        {expanded ? (
          <div className="space-y-3 border-t border-violet-100 pt-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5 text-[10px]">
              <p className="font-bold text-gray-800">Penalties applied</p>
              <p className="text-gray-600">
                Reputation base {metrics.reputationScore ?? '—'} − chargeback ({penalties.chargeback ?? 0}) − strikes (
                {penalties.contentStrikes ?? 0}) − response ({penalties.responseTime ?? 0})
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1 text-[10px]">
              <p className="font-bold text-gray-800 mb-2">Auto-review thresholds</p>
              <ThresholdRow label="Health score" value={`< ${cfg.autoReviewScoreThreshold ?? 60}`} />
              <ThresholdRow label="Dispute rate" value={`≥ ${cfg.autoReviewDisputeRatePct ?? 10}% (min 5 orders)`} />
              <ThresholdRow label="Chargebacks" value={`≥ ${cfg.autoReviewChargebackCount ?? 2}`} />
              <ThresholdRow label="Content strikes" value={`≥ ${cfg.autoReviewContentStrikes ?? 3}`} />
              <ThresholdRow
                label="Median response"
                value={`≥ ${formatMinutes(cfg.autoReviewMedianResponseMinutes ?? 720)} (min 3 samples)`}
              />
              {cfg.notes ? <p className="text-gray-500 mt-2 leading-relaxed">{cfg.notes}</p> : null}
            </div>

            {(payload.recentStrikes?.length ?? 0) > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 max-h-36 overflow-y-auto space-y-2">
                <p className="text-[9px] font-bold uppercase text-gray-400">Recent trust events</p>
                {payload.recentStrikes?.map((ev, idx) => (
                  <div key={`${ev.event_type}-${idx}`} className="text-[10px] border-b border-gray-50 pb-1 last:border-0">
                    <span className="font-bold text-gray-800">{ev.event_type}</span>
                    <span className="text-gray-400"> · +{ev.points} pts · </span>
                    <span className="text-gray-500">
                      {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/clawback-debts"
                className="text-[10px] font-bold rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              >
                Clawback debts
              </Link>
              <Link
                href="/dashboard/finance"
                className="text-[10px] font-bold rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              >
                Dispute tribunal
              </Link>
              <Link
                href="/dashboard/moderator"
                className="text-[10px] font-bold rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
              >
                Moderation
              </Link>
            </div>

            {payload.asOf ? (
              <p className="text-[9px] text-gray-400">
                Computed {new Date(payload.asOf).toLocaleString()} · read-only admin scorecard
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Gavel
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-lg bg-white/80 border border-violet-100 p-3">
      <p className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
        <Icon size={10} className="text-violet-500" /> {label}
      </p>
      <p className="text-sm font-black text-gray-900 mt-1">{value}</p>
      <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}

function ThresholdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono font-semibold text-gray-800">{value}</span>
    </div>
  )
}
