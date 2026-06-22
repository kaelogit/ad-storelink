'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Loader2, RefreshCcw, ShieldOff } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { Card, CardContent, CardHeader } from '../../../components/ui'
import { parseApiError } from '../../../utils/http'
import type { AdminRole } from '../../../types/admin'
import { createClient } from '../../../utils/supabase/client'

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

type PendingAction =
  | { type: 'flag'; key: string; enabled: boolean; rolloutPercent: number }
  | { type: 'experiment'; key: string; freezeControl: boolean; isActive?: boolean }
  | { type: 'kill_switch' }

export default function ExperimentsDashboardPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [state, setState] = useState<RolloutState | null>(null)
  const [homeRows, setHomeRows] = useState<HomeSessionRow[]>([])
  const [exploreRows, setExploreRows] = useState<ExploreSessionRow[]>([])
  const [homeKey, setHomeKey] = useState('home_feed_rank_v1')
  const [exploreKey, setExploreKey] = useState('explore_feed_rank_v1')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canEdit = adminRole === 'super_admin'

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted && data?.role) setAdminRole(data.role as AdminRole)
    }
    void loadRole()
    return () => { mounted = false }
  }, [supabase])

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ homeKey, exploreKey })
    const response = await fetch(`/api/admin/experiments/state?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load experiments state.')
      setFeedback({ tone: 'error', message: msg })
      setLoading(false)
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
    setLoading(false)
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
      impact: pendingAction.freezeControl ? 'All users get control variant.' : `is_active=${pendingAction.isActive ?? 'unchanged'}`,
    }
  }, [pendingAction])

  const flagByKey = useMemo(() => {
    const map = new Map<string, FeatureFlagRow>()
    for (const f of state?.flags ?? []) map.set(f.key, f)
    return map
  }, [state?.flags])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ranking Experiments"
        subtitle="Home / Explore v2 rollout flags, calibration experiments, v3 knobs, and session metrics."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      {!canEdit ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Analyst view: read metrics and current rollout. Super Admin required to change flags or experiments.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setPendingAction({ type: 'kill_switch' })}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            <ShieldOff className="h-4 w-4" />
            Kill switch (v2 off + freeze)
          </button>
        ) : null}
      </div>

      {loading && !state ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(['home_feed_rank_v2_enabled', 'explore_rank_v2_enabled'] as const).map((key) => {
              const flag = flagByKey.get(key)
              const surface = key.includes('home') ? 'Home' : 'Explore'
              return (
                <div key={key} className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">{surface} v2 flag</p>
                      <p className="text-sm font-mono font-bold text-gray-900 mt-1">{key}</p>
                    </div>
                    <StatusBadge
                      label={flag?.enabled ? `${flag.rollout_percent}% live` : 'Off'}
                      tone={flag?.enabled && (flag.rollout_percent ?? 0) > 0 ? 'success' : 'neutral'}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Updated {flag?.updated_at ? new Date(flag.updated_at).toLocaleString() : '—'}
                  </p>
                  {canEdit ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ROLLOUT_PRESETS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPendingAction({
                            type: 'flag',
                            key,
                            enabled: pct > 0,
                            rolloutPercent: pct,
                          })}
                          className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-800 hover:bg-indigo-50"
                        >
                          {pct === 0 ? 'Off' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <FlaskConical size={14} /> v2 calibration experiments
              </h2>
              <p className="text-xs text-[var(--muted)]">Weights must match variant count. Use Freeze for safe rollback.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(state?.experiments ?? []).map((exp) => (
                <div key={exp.key} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono font-bold text-gray-900">{exp.key}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{exp.description}</p>
                    </div>
                    <StatusBadge label={exp.is_active ? 'Active' : 'Inactive'} tone={exp.is_active ? 'success' : 'warning'} />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2 font-mono break-all">
                    variants: {JSON.stringify(exp.variants ?? [])}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono break-all">
                    weights: {JSON.stringify(exp.weights ?? [])}
                  </p>
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingAction({
                          type: 'experiment',
                          key: exp.key,
                          freezeControl: true,
                        })}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800"
                      >
                        Freeze to control
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAction({
                          type: 'experiment',
                          key: exp.key,
                          freezeControl: false,
                          isActive: !exp.is_active,
                        })}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-700"
                      >
                        {exp.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">v3 calibration knobs (read-only)</h2>
              <p className="text-xs text-[var(--muted)]">
                Runtime multipliers from feature_flags.config. View on{' '}
                <Link href="/dashboard/feature-flags" className="font-bold text-violet-600 underline">Feature Flags</Link> (calibration category).
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(state?.v3_knobs ?? []).map((knob) => (
                <div key={knob.key} className="rounded-lg border border-dashed border-gray-200 p-3">
                  <p className="text-[10px] font-mono font-bold text-gray-800">{knob.key}</p>
                  <pre className="text-[9px] text-gray-600 mt-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(knob.config ?? {}, null, 2)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-gray-500">
              Home sessions key
              <select
                value={homeKey}
                onChange={(e) => setHomeKey(e.target.value)}
                className="ml-2 rounded border border-gray-200 px-2 py-1 text-gray-800"
              >
                <option value="home_feed_rank_v1">home_feed_rank_v1</option>
                <option value="home_feed_rank_v2">home_feed_rank_v2</option>
              </select>
            </label>
            <label className="text-xs font-bold text-gray-500">
              Explore sessions key
              <select
                value={exploreKey}
                onChange={(e) => setExploreKey(e.target.value)}
                className="ml-2 rounded border border-gray-200 px-2 py-1 text-gray-800"
              >
                <option value="explore_feed_rank_v1">explore_feed_rank_v1</option>
                <option value="explore_feed_rank_v2_discovery">explore_feed_rank_v2_discovery</option>
                <option value="explore_feed_rank_v2_for_you">explore_feed_rank_v2_for_you</option>
                <option value="explore_feed_rank_v2_spotlight">explore_feed_rank_v2_spotlight</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SessionTable
              title={`Home sessions – ${homeKey}`}
              empty="No Home sessions in the last 14 days."
              rows={homeRows}
              columns={[
                ['Sessions', (r: HomeSessionRow) => r.sessions],
                ['Avg time', (r) => r.avg_duration_ms != null ? `${Math.round(r.avg_duration_ms / 1000)}s` : '—'],
                ['Items', (r) => r.avg_items_seen?.toFixed(1) ?? '—'],
                ['Clicks', (r) => r.avg_clicks?.toFixed(1) ?? '—'],
                ['Cart', (r) => r.avg_add_to_cart?.toFixed(2) ?? '—'],
                ['Book', (r) => r.avg_service_book_requests?.toFixed(2) ?? '—'],
              ]}
            />
            <SessionTable
              title={`Explore sessions – ${exploreKey}`}
              empty="No Explore sessions in the last 14 days."
              rows={exploreRows}
              columns={[
                ['Sessions', (r: ExploreSessionRow) => r.sessions],
                ['Avg time', (r) => r.avg_duration_ms != null ? `${Math.round(r.avg_duration_ms / 1000)}s` : '—'],
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
  empty,
  rows,
  columns,
}: {
  title: string
  empty: string
  rows: T[]
  columns: [string, (row: T) => string | number][]
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="text-xs text-[var(--muted)]">Last 14 days, grouped by variant.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--muted)] flex flex-col items-center gap-2">
            <AlertTriangle size={16} className="text-gray-300" />
            {empty}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">Variant</th>
                  {columns.map(([label]) => (
                    <th key={label} className="px-3 py-2 text-right font-medium text-[var(--muted)]">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.variant} className="border-b border-[var(--border)]/60 last:border-0">
                    <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.variant}</td>
                    {columns.map(([label, render]) => (
                      <td key={label} className="px-3 py-2 text-right">{render(row)}</td>
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
