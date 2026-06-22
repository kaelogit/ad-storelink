'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Flag, Loader2, RefreshCcw, Search } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../../../components/ui/DataTable'
import { parseApiError } from '../../../utils/http'
import type { AdminRole } from '../../../types/admin'
import { createClient } from '../../../utils/supabase/client'

type FlagRow = {
  key: string
  enabled: boolean
  rollout_percent: number
  description?: string | null
  config?: Record<string, unknown>
  category?: string
  updated_at?: string
  last_change?: {
    admin_email?: string | null
    created_at?: string
    action_type?: string
  } | null
}

type PendingUpdate = {
  key: string
  enabled: boolean
  rolloutPercent: number
}

const ROLLOUT_PRESETS = [0, 1, 5, 10, 20, 50, 100]

const REASON_CATEGORIES = [
  { value: 'rollout', label: 'Rollout / ramp' },
  { value: 'rollback', label: 'Rollback / incident' },
  { value: 'staging_validation', label: 'Staging validation' },
  { value: 'canary', label: 'Canary expansion' },
  { value: 'product_launch', label: 'Product launch' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'product', label: 'Product' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'calibration', label: 'Calibration' },
] as const

export default function FeatureFlagsPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [rows, setRows] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]['id']>('all')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

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

  const loadFlags = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ category, q: query.trim() })
    const response = await fetch(`/api/admin/feature-flags/list?${params.toString()}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Failed to load feature flags.')
      setFeedback({ tone: 'error', message: msg })
      setRows([])
      setLoading(false)
      return
    }
    const json = (await response.json()) as { flags?: FlagRow[] }
    setRows(json.flags ?? [])
    setLoading(false)
  }, [category, query])

  useEffect(() => {
    void loadFlags()
  }, [loadFlags])

  const productFlags = useMemo(
    () => rows.filter((r) => r.category === 'product' || ['spotlight_enabled', 'buyer_follow_enabled', 'index_header_motion_v2'].includes(r.key)),
    [rows],
  )

  const submitUpdate = async (payload: { category: string; reason: string }) => {
    if (!pendingUpdate) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/feature-flags/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          key: pendingUpdate.key,
          enabled: pendingUpdate.enabled,
          rolloutPercent: pendingUpdate.rolloutPercent,
          reason: `[${payload.category}] ${payload.reason.trim()}`,
        }),
      })
      if (!response.ok) {
        const msg = await parseApiError(response, 'Flag update failed.')
        setFeedback({ tone: 'error', message: msg })
        return
      }
      setFeedback({ tone: 'success', message: `${pendingUpdate.key} updated and audited.` })
      setPendingUpdate(null)
      await loadFlags()
    } finally {
      setSubmitting(false)
    }
  }

  const tabClass = (id: string) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      category === id ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        subtitle="Toggle product and platform flags without SQL. Ranking v2 quick controls live on Experiments."
      />

      {feedback && <ActionFeedback tone={feedback.tone} message={feedback.message} />}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-2">
        <p className="font-bold uppercase tracking-wider text-[10px] text-blue-600">Staging-safe workflow</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Validate changes on <strong>staging</strong> first (same flag keys).</li>
          <li>Start with low rollout (1–5%) for user-facing flags; watch Observability + session metrics.</li>
          <li>Document reason in the confirm modal — appears in Audit Log as last changed by.</li>
          <li>For ranking v2 kill switch / experiment freeze, use <Link href="/dashboard/experiments" className="font-bold underline">Experiments</Link>.</li>
          <li>Production rollback: set <code className="font-mono">enabled=false</code> or rollout <code className="font-mono">0%</code>.</li>
        </ol>
      </div>

      {!canEdit ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Analyst view: inspect flags and last change. Super Admin required to edit.
        </p>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button key={tab.id} type="button" className={tabClass(tab.id)} onClick={() => setCategory(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search key or description..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadFlags()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {category === 'all' && productFlags.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['spotlight_enabled', 'buyer_follow_enabled', 'index_header_motion_v2'].map((key) => {
            const row = rows.find((r) => r.key === key)
            if (!row) return null
            return (
              <div key={key} className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag size={14} className="text-violet-600" />
                  <p className="text-xs font-mono font-bold text-gray-900">{key}</p>
                </div>
                <p className="text-[10px] text-gray-600">{row.description}</p>
                <p className="text-sm font-black text-gray-900 mt-2">
                  {row.enabled ? `${row.rollout_percent}%` : 'Off'}
                </p>
                {canEdit ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ROLLOUT_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPendingUpdate({ key, enabled: pct > 0, rolloutPercent: pct })}
                        className="rounded border border-violet-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-violet-800"
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
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : (
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Flag</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Last changed</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => (
                <DataTableRow key={row.key}>
                  <DataTableCell className="align-top max-w-md">
                    <p className="font-mono text-xs font-bold text-gray-900">{row.key}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{row.description || '—'}</p>
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
                      className="text-[10px] text-violet-600 font-bold mt-1"
                    >
                      {expandedKey === row.key ? 'Hide config' : 'View config'}
                    </button>
                    {expandedKey === row.key ? (
                      <pre className="text-[9px] text-gray-600 mt-2 whitespace-pre-wrap break-all bg-gray-50 p-2 rounded border">
                        {JSON.stringify(row.config ?? {}, null, 2)}
                      </pre>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="align-top">
                    <StatusBadge
                      label={row.enabled && row.rollout_percent > 0 ? `${row.rollout_percent}%` : 'Off'}
                      tone={row.enabled && row.rollout_percent > 0 ? 'success' : 'neutral'}
                    />
                    <p className="text-[10px] text-gray-400 mt-1 capitalize">{row.category}</p>
                    <p className="text-[10px] text-gray-400">
                      DB {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                    </p>
                  </DataTableCell>
                  <DataTableCell className="align-top text-[10px] text-gray-600">
                    {row.last_change?.admin_email ? (
                      <>
                        <p className="font-semibold text-gray-800">{row.last_change.admin_email}</p>
                        <p>{row.last_change.created_at ? new Date(row.last_change.created_at).toLocaleString() : '—'}</p>
                        <p className="text-gray-400">{row.last_change.action_type}</p>
                      </>
                    ) : (
                      <span className="text-gray-400">No audit entry yet</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="align-top text-right">
                    {canEdit ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {ROLLOUT_PRESETS.map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setPendingUpdate({
                              key: row.key,
                              enabled: pct > 0,
                              rolloutPercent: pct,
                            })}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 hover:border-violet-300"
                          >
                            {pct === 0 ? 'Off' : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">Read-only</span>
                    )}
                    {row.key.includes('rank_v2') ? (
                      <Link href="/dashboard/experiments" className="block text-[10px] font-bold text-violet-600 mt-2">
                        Ranking desk →
                      </Link>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <ActionReasonModal
        open={pendingUpdate !== null}
        title={pendingUpdate ? `Update ${pendingUpdate.key}` : 'Update flag'}
        description="Writes to feature_flags.enabled and rollout_percent. Mobile apps resolve via resolve_feature_flag."
        impactSummary={
          pendingUpdate
            ? `enabled=${pendingUpdate.enabled}, rollout=${pendingUpdate.rolloutPercent}%`
            : undefined
        }
        categoryOptions={REASON_CATEGORIES}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setPendingUpdate(null)
        }}
        onSubmit={submitUpdate}
      />
    </div>
  )
}
