'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ClipboardCheck,
  ExternalLink,
  Play,
  RefreshCcw,
} from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { EscrowHealthPanel } from '../../../components/admin/EscrowHealthPanel'
import { QaRunbookCards } from '../../../components/admin/QaRunbookCards'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { EmptyState } from '../../../components/admin/EmptyState'
import { STAGING_SMOKE_CHECKLIST } from '../../../constants/qaRunbooks'
import { roleCanOpenPath } from '../../../constants/adminNavigation'
import { useAdminRole } from '../../../hooks/useAdminRole'

type SafetyTestCase = {
  name: string
  status: string
  duration_ms?: number | null
  failureMessages?: string[]
}

type SafetySuite = {
  id: string
  name: string
  category: string
  file?: string
  status: string
  passed: number
  failed: number
  skipped: number
  duration_ms?: number | null
  tests: SafetyTestCase[]
}

type SafetyRun = {
  id: string
  repo: string
  branch: string | null
  commit_sha: string | null
  triggered_by: string
  status: string
  total_tests: number
  passed_tests: number
  failed_tests: number
  skipped_tests: number
  duration_ms: number | null
  suites: SafetySuite[]
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  checkout: 'Checkout & orders',
  paystack: 'Paystack & payments',
  cart: 'Cart & pricing',
  share: 'Share sheet & URLs',
  feed: 'Feed fetch & errors',
  delete: 'Delete & ownership',
  refund: 'Refunds',
  infra: 'Infrastructure',
}

const RUN_REASON_CATEGORIES = [
  { value: 'pre_deploy', label: 'Pre-deploy check' },
  { value: 'post_deploy', label: 'Post-deploy verification' },
  { value: 'incident_investigation', label: 'Incident investigation' },
  { value: 'routine', label: 'Routine health check' },
  { value: 'other', label: 'Other' },
]

const SMOKE_STORAGE_KEY = 'storelink.qa.smoke.checked.v1'

export default function QaHubPage() {
  const { role, loading: roleLoading } = useAdminRole()
  const canRun = role === 'super_admin'
  const [runs, setRuns] = useState<SafetyRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>({})
  const [runningMode, setRunningMode] = useState<'live' | 'ci' | null>(null)
  const [pendingMode, setPendingMode] = useState<'live' | 'ci' | null>(null)
  const [checkedSmoke, setCheckedSmoke] = useState<Record<string, boolean>>({})
  const [actionFeedback, setActionFeedback] = useState<{
    tone: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SMOKE_STORAGE_KEY)
      if (raw) setCheckedSmoke(JSON.parse(raw) as Record<string, boolean>)
    } catch {
      /* ignore */
    }
  }, [])

  const persistSmoke = (next: Record<string, boolean>) => {
    setCheckedSmoke(next)
    try {
      localStorage.setItem(SMOKE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/safety-tests?limit=25')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load safety tests')
      setRuns((json.runs as SafetyRun[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const runTests = async (
    mode: 'live' | 'ci',
    { category, reason }: { category: string; reason: string },
  ) => {
    setRunningMode(mode)
    setActionFeedback(null)
    try {
      const res = await fetch('/api/admin/safety-tests/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `safety-tests-${mode}-${Date.now()}`,
        },
        body: JSON.stringify({ mode, reason: `[${category}] ${reason}` }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to run tests')
      setPendingMode(null)
      if (mode === 'live') {
        const passed = json.run?.status === 'passed'
        setActionFeedback({
          tone: passed ? 'success' : 'error',
          message: passed
            ? `Live probes passed (${json.run.passed_tests}/${json.run.total_tests}).`
            : `Live probes failed (${json.run?.failed_tests ?? 0} failed).`,
        })
        await fetchRuns()
      } else {
        setActionFeedback({
          tone: 'success',
          message: json.message || 'CI suite dispatched. Refresh in a minute.',
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to run tests'
      setActionFeedback({ tone: 'error', message })
      throw e instanceof Error ? e : new Error(message)
    } finally {
      setRunningMode(null)
    }
  }

  useEffect(() => {
    void fetchRuns()
  }, [fetchRuns])

  const latest = runs[0] ?? null

  const smokeChecklist = useMemo(
    () => STAGING_SMOKE_CHECKLIST.filter((item) => roleCanOpenPath(role, item.href)),
    [role],
  )

  const smokeDone = smokeChecklist.filter((item) => checkedSmoke[item.href + item.label]).length
  const smokeTotal = smokeChecklist.length

  const suitesByCategory = useMemo(() => {
    if (!latest?.suites?.length) return []
    const map = new Map<string, SafetySuite[]>()
    for (const suite of latest.suites) {
      const cat = suite.category || 'infra'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(suite)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [latest])

  const toggleSuite = (key: string) => {
    setExpandedSuites((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="QA Hub"
        subtitle="Pre-deploy go/no-go: escrow health, staging smoke paths, and live/CI safety probes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canRun ? (
              <>
                <button
                  type="button"
                  onClick={() => setPendingMode('live')}
                  disabled={!!runningMode}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {runningMode === 'live' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Run live probes
                </button>
                <button
                  type="button"
                  onClick={() => setPendingMode('ci')}
                  disabled={!!runningMode}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {runningMode === 'ci' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Trigger CI
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void fetchRuns()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
        }
      />

      {!roleLoading && !canRun ? (
        <ActionFeedback
          tone="info"
          message="Read-only for your role. Running live probes and triggering CI require super_admin."
        />
      ) : null}

      {actionFeedback ? (
        <ActionFeedback tone={actionFeedback.tone} message={actionFeedback.message} />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <EscrowHealthPanel />
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Latest probe / CI result</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Live probes hit taxonomy, embeddings, and DB from this desk. CI needs{' '}
                <code className="rounded bg-zinc-100 px-1">GITHUB_TOKEN</code>.
              </p>
            </div>
            {latest ? (
              <StatusBadge
                tone={latest.status === 'passed' ? 'success' : 'danger'}
                label={latest.status === 'passed' ? 'Passed' : 'Failed'}
              />
            ) : (
              <StatusBadge tone="neutral" label="No runs" />
            )}
          </div>

          {loading && !latest ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : !latest ? (
            <div className="mt-6 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm font-semibold text-zinc-800">No test runs yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                {canRun
                  ? 'Run live probes to save a go/no-go snapshot before deploy.'
                  : 'A super admin can run live probes from this desk.'}
              </p>
            </div>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Score</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                  {latest.passed_tests}/{latest.total_tests} passed
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">When</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {latest.created_at ? new Date(latest.created_at).toLocaleString() : '—'}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Triggered by
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-zinc-900">
                  {latest.triggered_by}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Duration
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                  {latest.duration_ms != null ? `${(latest.duration_ms / 1000).toFixed(1)}s` : '—'}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Staging smoke paths</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Check off after migrations. Progress is saved in this browser.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={smokeDone === smokeTotal && smokeTotal > 0 ? 'success' : 'info'}
              label={`${smokeDone}/${smokeTotal} done`}
            />
            {smokeDone > 0 ? (
              <button
                type="button"
                onClick={() => persistSmoke({})}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
              >
                Clear checks
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {smokeChecklist.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">
              {roleLoading ? 'Loading…' : 'No smoke-path desks are available for your role.'}
            </p>
          ) : (
            <ol className="divide-y divide-zinc-100">
              {smokeChecklist.map((item, index) => {
                const key = item.href + item.label
                const checked = Boolean(checkedSmoke[key])
                return (
                  <li key={key} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                    <button
                      type="button"
                      aria-pressed={checked}
                      onClick={() => persistSmoke({ ...checkedSmoke, [key]: !checked })}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                        checked
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-zinc-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </button>
                    <span className="w-5 shrink-0 text-[11px] tabular-nums text-zinc-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <ClipboardCheck
                      className={`h-3.5 w-3.5 shrink-0 ${checked ? 'text-emerald-600' : 'text-zinc-400'}`}
                    />
                    <span
                      className={`min-w-0 flex-1 text-sm ${
                        checked ? 'text-zinc-400 line-through' : 'font-medium text-zinc-800'
                      }`}
                    >
                      {item.label}
                    </span>
                    <Link
                      href={item.href}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Open
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Runbooks</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Longer checklists live in the repo docs; links jump to the desks you need.
          </p>
        </div>
        <QaRunbookCards />
      </section>

      {latest?.suites?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Suites by category</h2>
          <div className="space-y-3">
            {suitesByCategory.map(([category, suites]) => (
              <div key={category} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {suites.filter((s) => s.status === 'passed').length}/{suites.length} suites passed
                  </p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {suites.map((suite) => {
                    const suiteKey = `${latest.id}-${suite.id}`
                    const open = expandedSuites[suiteKey] ?? false
                    return (
                      <div key={suiteKey}>
                        <button
                          type="button"
                          onClick={() => toggleSuite(suiteKey)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                          )}
                          {suite.status === 'passed' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                          )}
                          <span className="flex-1 text-sm font-medium text-zinc-900">{suite.name}</span>
                          <span className="text-xs text-zinc-500">
                            {suite.passed}/{suite.passed + suite.failed} tests
                          </span>
                        </button>
                        {open ? (
                          <ul className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-2">
                            {suite.tests.map((test) => (
                              <li
                                key={test.name}
                                className="flex items-start gap-2 border-b border-zinc-100 py-2 last:border-0"
                              >
                                {test.status === 'passed' ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                ) : (
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-zinc-800">{test.name}</p>
                                  {test.failureMessages?.map((msg, i) => (
                                    <pre
                                      key={i}
                                      className="mt-1 max-h-32 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800"
                                    >
                                      {msg}
                                    </pre>
                                  ))}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {runs.length > 1 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">Run history</p>
              </div>
              <ul className="divide-y divide-zinc-100">
                {runs.slice(1).map((run) => (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="text-zinc-800">{new Date(run.created_at).toLocaleString()}</span>
                    <span className="text-xs text-zinc-500">
                      {run.passed_tests}/{run.total_tests} · {run.triggered_by}
                    </span>
                    <StatusBadge
                      tone={run.status === 'passed' ? 'success' : 'danger'}
                      label={run.status}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : !loading && !latest ? (
        <EmptyState
          icon={ShieldCheck}
          title="Results will show here"
          message="After the first live probe or CI publish, suite breakdowns and history appear in this section."
        />
      ) : null}

      <ActionReasonModal
        open={pendingMode !== null}
        title={pendingMode === 'ci' ? 'Trigger CI safety suite?' : 'Run live production probes?'}
        description={
          pendingMode === 'ci'
            ? 'Dispatches the GitHub safety-tests workflow. This action is recorded in the admin audit log.'
            : 'Runs read-only probes against the production database from this admin server. This action is recorded in the admin audit log.'
        }
        impactSummary={
          pendingMode === 'ci'
            ? 'Consumes GitHub Actions minutes; results appear here when the workflow finishes.'
            : 'A new live-probe run is saved to the results history.'
        }
        categoryOptions={RUN_REASON_CATEGORIES}
        submitting={!!runningMode}
        onClose={() => {
          if (!runningMode) setPendingMode(null)
        }}
        onSubmit={async (payload) => {
          if (!pendingMode) return
          await runTests(pendingMode, payload)
        }}
      />
    </div>
  )
}
