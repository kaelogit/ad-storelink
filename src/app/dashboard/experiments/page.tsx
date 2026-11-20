'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Loader2, RefreshCcw, ShieldOff, Snowflake } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { EmptyState } from '../../../components/admin/EmptyState'
import { Card, CardContent, CardHeader } from '../../../components/ui'
import { parseApiError } from '../../../utils/http'
import { useAdminRole } from '../../../hooks/useAdminRole'

type HomeSessionRow = {
  variant: string
  sessions: number
  avg_duration_ms: number | null
  avg_items_seen: number | null
  avg_clicks: number | null
  avg_add_to_cart: number | null
  avg_service_book_requests: number | null
}

type ExploreSessionRow = {
  variant: string
  sessions: number
  avg_duration_ms: number | null
  avg_items_seen: number | null
  avg_profile_taps: number | null
  avg_product_clicks: number | null
}

type FeatureFlagRow = {
  key: string
  enabled: boolean
  rollout_percent: number
  config?: Record<string, unknown>
  updated_at?: string
}

type ExperimentRow = {
  key: string
  is_active: boolean
  description?: string | null
  variants?: string[]
  weights?: number[]
  updated_at?: string
}

type RolloutState = {
  flags?: FeatureFlagRow[]
  experiments?: ExperimentRow[]
  v3_knobs?: FeatureFlagRow[]
}

const ROLLOUT_PRESETS = [0, 1, 5, 20, 50, 100]

const REASON_CATEGORIES = [
  { value: 'rollout_ramp', label: 'Rollout ramp' },
  { value: 'rollback', label: 'Rollback / incident' },
  { value: 'calibration', label: 'Calibration tuning' },
  { value: 'kill_switch', label: 'Kill switch' },
  { value: 'staging_test', label: 'Staging validation' },
  { value: 'other', label: 'Other' },
]

const HOME_SESSION_KEYS = [
  { value: 'home_feed_rank_v1', label: 'Home v1' },
  { value: 'home_feed_rank_v2', label: 'Home v2' },
] as const

const EXPLORE_SESSION_KEYS = [
  { value: 'explore_feed_rank_v1', label: 'Explore v1' },
  { value: 'explore_feed_rank_v2_discovery', label: 'Discovery v2' },
  { value: 'explore_feed_rank_v2_for_you', label: 'For you v2' },
  { value: 'explore_feed_rank_v2_spotlight', label: 'Spotlight v2' },
] as const

type PendingAction =
  | { type: 'flag'; key: string; enabled: boolean; rolloutPercent: number }
  | { type: 'experiment'; key: string; freezeControl: boolean; isActive?: boolean }
  | { type: 'kill_switch' }

function numConfig(config: Record<string, unknown> | undefined, key: string): number | null {
  const v = config?.[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function shortKnobLabel(key: string): string {
  if (key.includes('home')) return 'Home'
  if (key.includes('spotlight')) return 'Spotlight'
  if (key.includes('for_you')) return 'For you'
  if (key.includes('discovery')) return 'Discovery'
  return key.replace(/_rank_v3_knobs$/, '').replace(/_/g, ' ')
}

function WeightBars({ variants, weights }: { variants: string[]; weights: number[] }) {
  const total = weights.reduce((s, w) => s + Number(w || 0), 0) || 1
  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
        {variants.map((variant, i) => {
          const w = Number(weights[i] || 0)
          const pct = (w / total) * 100
          if (pct <= 0) return null
          const isControl = variant === 'control'
          return (
            <div
              key={`${variant}-${i}`}
              title={`${variant}: ${w}`}
              style={{ width: `${pct}%` }}
              className={isControl ? 'bg-zinc-500' : 'bg-emerald-500/80'}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {variants.map((variant, i) => {
          const w = Number(weights[i] || 0)
          const pct = Math.round((w / total) * 100)
          return (
            <span
              key={`${variant}-chip-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700"
            >
              <span className="font-semibold">{variant}</span>
              <span className="tabular-nums text-zinc-400">{w}</span>
              <span className="tabular-nums text-zinc-400">({pct}%)</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function KnobCard({ knob }: { knob: FeatureFlagRow }) {
  const cfg = knob.config ?? {}
  const quality = numConfig(cfg, 'quality_multiplier')
  const affinity = numConfig(cfg, 'affinity_multiplier')
  const negative = numConfig(cfg, 'negative_multiplier')
  const maxBonus = numConfig(cfg, 'max_bonus')
  const maxPenalty = numConfig(cfg, 'max_penalty')
  const frozen = Boolean(cfg.phase5_baseline_frozen)
  const freezeNote = typeof cfg.phase5_freeze_note === 'string' ? cfg.phase5_freeze_note : null
  const frozenAt = typeof cfg.phase5_frozen_at === 'string' ? cfg.phase5_frozen_at : null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{shortKnobLabel(knob.key)}</p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{knob.key}</p>
        </div>
        <StatusBadge
          label={frozen ? 'Baseline frozen' : 'Live knobs'}
          tone={frozen ? 'info' : 'success'}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Quality ×" value={quality != null ? quality.toFixed(2) : '—'} />
        <Metric label="Affinity ×" value={affinity != null ? affinity.toFixed(2) : '—'} />
        <Metric label="Negative ×" value={negative != null ? negative.toFixed(2) : '—'} />
        <Metric label="Max bonus" value={maxBonus != null ? maxBonus.toFixed(2) : '—'} />
        <Metric label="Max penalty" value={maxPenalty != null ? maxPenalty.toFixed(2) : '—'} />
      </div>

      {freezeNote || frozenAt ? (
        <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] leading-relaxed text-zinc-500">
          {freezeNote}
          {frozenAt ? (
            <span className="mt-1 block text-[10px] text-zinc-400">
              Frozen {new Date(frozenAt).toLocaleString()}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  )
}

export default function ExperimentsDashboardPage() {
  const { role, loading: roleLoading } = useAdminRole()
  const [state, setState] = useState<RolloutState | null>(null)
  const [homeRows, setHomeRows] = useState<HomeSessionRow[]>([])
  const [exploreRows, setExploreRows] = useState<ExploreSessionRow[]>([])
  const [homeKey, setHomeKey] = useState('home_feed_rank_v1')
  const [exploreKey, setExploreKey] = useState('explore_feed_rank_v1')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canEdit = role === 'super_admin'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ homeKey, exploreKey })
      const response = await fetch(`/api/admin/experiments/state?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Failed to load experiments state.')
        setFeedback({ tone: 'error', message: msg })
        return
      }
      const json = (await response.json()) as {
        state?: RolloutState
        homeSummary?: HomeSessionRow[]
        exploreSummary?: ExploreSessionRow[]
      }
      setState(json.state ?? null)
      setHomeRows(json.homeSummary ?? [])
      setExploreRows(json.exploreSummary ?? [])
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to load experiments state.',
      })
    } finally {
      setLoading(false)
    }
  }, [exploreKey, homeKey])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const submitAction = async (payload: { category: string; reason: string }) => {
    if (!pendingAction) return
    setSubmitting(true)
    try {
      let response: Response
      const headers = {
        'Content-Type': 'application/json',
        'x-idempotency-key': crypto.randomUUID(),
      }
      const reason = `[${payload.category}] ${payload.reason.trim()}`

      if (pendingAction.type === 'flag') {
        response = await fetch('/api/admin/experiments/flag', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: pendingAction.key,
            enabled: pendingAction.enabled,
            rolloutPercent: pendingAction.rolloutPercent,
            reason,
          }),
        })
      } else if (pendingAction.type === 'experiment') {
        response = await fetch('/api/admin/experiments/experiment', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: pendingAction.key,
            freezeControl: pendingAction.freezeControl,
            isActive: pendingAction.isActive,
            reason,
          }),
        })
      } else {
        response = await fetch('/api/admin/experiments/kill-switch', {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        })
      }

      if (!response.ok) {
        const msg = await parseApiError(response, 'Update failed.')
        setFeedback({ tone: 'error', message: msg })
        return
      }

      setFeedback({ tone: 'success', message: 'Ranking rollout updated and audited.' })
      setPendingAction(null)
      await loadData()
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Update failed.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const actionCopy = useMemo(() => {
    if (!pendingAction) return null
    if (pendingAction.type === 'kill_switch') {
      return {
        title: 'Execute ranking kill switch',
        description: 'Disables Home + Explore v2 flags and freezes all v2 experiments to control-only.',
        impact: 'Users fall back to v1 ranking paths immediately (subject to app cache).',
      }
    }
    if (pendingAction.type === 'flag') {
      return {
        title: `Update ${pendingAction.key}`,
        description: 'Maps directly to feature_flags.enabled and rollout_percent.',
        impact: `enabled=${pendingAction.enabled}, rollout=${pendingAction.rolloutPercent}%`,
      }
    }
    return {
      title: pendingAction.freezeControl ? `Freeze ${pendingAction.key}` : `Update ${pendingAction.key}`,
      description: pendingAction.freezeControl
        ? 'Sets variants to ["control"] and weights to [100].'
        : 'Toggle experiment active state.',
      impact: pendingAction.freezeControl
        ? 'All users get control variant.'
        : `is_active=${pendingAction.isActive ?? 'unchanged'}`,
    }
  }, [pendingAction])

  const flagByKey = useMemo(() => {
    const map = new Map<string, FeatureFlagRow>()
    for (const f of state?.flags ?? []) map.set(f.key, f)
    return map
  }, [state?.flags])

  const anyV2Live = useMemo(() => {
    const home = flagByKey.get('home_feed_rank_v2_enabled')
    const explore = flagByKey.get('explore_rank_v2_enabled')
    return Boolean(
      (home?.enabled && (home.rollout_percent ?? 0) > 0) ||
        (explore?.enabled && (explore.rollout_percent ?? 0) > 0),
    )
  }, [flagByKey])

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ranking Experiments"
        subtitle="Single desk for Home/Explore v2 ramp, kill switch, experiment weights, and session metrics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/feature-flags?category=product"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Product flags
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setPendingAction({ type: 'kill_switch' })}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Kill switch
              </button>
            ) : null}
          </div>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
        <strong>This desk owns ranking rollout.</strong> Product flags and v3 knob edits stay on{' '}
        <Link href="/dashboard/feature-flags" className="font-semibold text-zinc-900 underline">
          Feature Flags
        </Link>
        . Ranking % controls there are disabled to avoid two sources of truth.
      </p>

      {!roleLoading && !canEdit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Analyst view. Metrics and rollout are visible; only Super Admin can change flags or experiments.
        </p>
      ) : null}

      {anyV2Live ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <strong>Launch hold:</strong> Home/Explore v2 are at low rollout. Keep freeze/kill switch ready until
          session metrics fill in after go-live.
        </p>
      ) : null}

      {loading && !state ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(['home_feed_rank_v2_enabled', 'explore_rank_v2_enabled'] as const).map((key) => {
              const flag = flagByKey.get(key)
              const surface = key.includes('home') ? 'Home' : 'Explore'
              const live = Boolean(flag?.enabled && (flag.rollout_percent ?? 0) > 0)
              const activePct = live ? flag!.rollout_percent : 0
              return (
                <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {surface} v2 flag
                      </p>
                      <p className="mt-1 font-mono text-xs font-semibold text-zinc-900">{key}</p>
                    </div>
                    <StatusBadge
                      label={live ? `${flag!.rollout_percent}% live` : 'Off'}
                      tone={live ? 'success' : 'neutral'}
                    />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, activePct))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-500">
                    Updated {flag?.updated_at ? new Date(flag.updated_at).toLocaleString() : '—'}
                  </p>
                  {canEdit ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ROLLOUT_PRESETS.map((pct) => {
                        const on = live ? activePct === pct : pct === 0
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'flag',
                                key,
                                enabled: pct > 0,
                                rolloutPercent: pct,
                              })
                            }
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                              on
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            {pct === 0 ? 'Off' : `${pct}%`}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <FlaskConical size={14} /> v2 calibration experiments
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Weights must match variant count. Freeze forces 100% control for safe rollback.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(state?.experiments ?? []).length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No experiments"
                  message="No v2 calibration experiments are configured."
                />
              ) : null}
              {(state?.experiments ?? []).map((exp) => {
                const variants = Array.isArray(exp.variants) ? exp.variants : []
                const weights = Array.isArray(exp.weights) ? exp.weights.map((w) => Number(w) || 0) : []
                return (
                  <div key={exp.key} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-zinc-900">{exp.key}</p>
                        {exp.description ? (
                          <p className="mt-0.5 text-[11px] text-zinc-500">{exp.description}</p>
                        ) : null}
                      </div>
                      <StatusBadge
                        label={exp.is_active ? 'Active' : 'Inactive'}
                        tone={exp.is_active ? 'success' : 'neutral'}
                      />
                    </div>
                    <WeightBars variants={variants} weights={weights} />
                    {canEdit ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              type: 'experiment',
                              key: exp.key,
                              freezeControl: true,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          <Snowflake className="h-3 w-3" />
                          Freeze to control
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              type: 'experiment',
                              key: exp.key,
                              freezeControl: false,
                              isActive: !exp.is_active,
                            })
                          }
                          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          {exp.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">v3 calibration knobs</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Read-only here. Edit multipliers on Feature Flags → Calibration.
                  </p>
                </div>
                <Link
                  href="/dashboard/feature-flags?category=calibration"
                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Edit on Feature Flags
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(state?.v3_knobs ?? []).length === 0 ? (
                <EmptyState title="No v3 knobs" message="No v3 calibration knobs are configured." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(state?.v3_knobs ?? []).map((knob) => (
                    <KnobCard key={knob.key} knob={knob} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-900">Session metrics</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Last 14 days by variant. Switch keys to compare v1 vs v2 surfaces.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-500">
                Home key
                <select
                  value={homeKey}
                  onChange={(e) => setHomeKey(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800"
                >
                  {HOME_SESSION_KEYS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-500">
                Explore key
                <select
                  value={exploreKey}
                  onChange={(e) => setExploreKey(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800"
                >
                  {EXPLORE_SESSION_KEYS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SessionTable
              title="Home sessions"
              keyLabel={homeKey}
              empty="No Home sessions in the last 14 days. Expected until traffic hits this experiment key."
              rows={homeRows}
              columns={[
                ['Sessions', (r: HomeSessionRow) => r.sessions],
                [
                  'Avg time',
                  (r) => (r.avg_duration_ms != null ? `${Math.round(r.avg_duration_ms / 1000)}s` : '—'),
                ],
                ['Items', (r) => r.avg_items_seen?.toFixed(1) ?? '—'],
                ['Clicks', (r) => r.avg_clicks?.toFixed(1) ?? '—'],
                ['Cart', (r) => r.avg_add_to_cart?.toFixed(2) ?? '—'],
                ['Book', (r) => r.avg_service_book_requests?.toFixed(2) ?? '—'],
              ]}
            />
            <SessionTable
              title="Explore sessions"
              keyLabel={exploreKey}
              empty="No Explore sessions in the last 14 days. Expected until traffic hits this experiment key."
              rows={exploreRows}
              columns={[
                ['Sessions', (r: ExploreSessionRow) => r.sessions],
                [
                  'Avg time',
                  (r) => (r.avg_duration_ms != null ? `${Math.round(r.avg_duration_ms / 1000)}s` : '—'),
                ],
                ['Items', (r) => r.avg_items_seen?.toFixed(1) ?? '—'],
                ['Profiles', (r) => r.avg_profile_taps?.toFixed(2) ?? '—'],
                ['Products', (r) => r.avg_product_clicks?.toFixed(2) ?? '—'],
              ]}
            />
          </div>
        </>
      )}

      <ActionReasonModal
        open={pendingAction !== null}
        title={actionCopy?.title ?? 'Confirm change'}
        description={actionCopy?.description ?? ''}
        impactSummary={actionCopy?.impact}
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setPendingAction(null)
        }}
        onSubmit={submitAction}
      />
    </div>
  )
}

function SessionTable<T extends { variant: string }>({
  title,
  keyLabel,
  empty,
  rows,
  columns,
}: {
  title: string
  keyLabel: string
  empty: string
  rows: T[]
  columns: [string, (row: T) => string | number][]
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{keyLabel}</p>
        <p className="mt-1 text-xs text-zinc-500">Last 14 days, grouped by variant.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-zinc-800">No sessions yet</p>
            <p className="mt-1 text-xs text-zinc-500">{empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Variant</th>
                  {columns.map(([label]) => (
                    <th key={label} className="px-3 py-2 text-right font-medium text-zinc-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.variant} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-zinc-900">{row.variant}</td>
                    {columns.map(([label, render]) => (
                      <td key={label} className="px-3 py-2 text-right tabular-nums text-zinc-700">
                        {render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
