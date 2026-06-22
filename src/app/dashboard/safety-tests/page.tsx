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
} from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { EscrowHealthPanel } from '../../../components/admin/EscrowHealthPanel'
import { QaRunbookCards } from '../../../components/admin/QaRunbookCards'
import { Card, CardContent, CardHeader, Badge } from '../../../components/ui'
import { STAGING_SMOKE_CHECKLIST } from '../../../constants/qaRunbooks'

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

export default function QaHubPage() {
  const [runs, setRuns] = useState<SafetyRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const latest = runs[0] ?? null

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
    <div className="space-y-8">
      <PageHeader
        title="QA Hub"
        subtitle="Runbooks, staging smoke paths, escrow health, and CI commerce safety tests — one place before risky deploys."
        actions={
          <button
            type="button"
            onClick={() => fetchRuns()}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Refresh CI results
          </button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Runbooks</h2>
        <QaRunbookCards />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Staging smoke paths</h2>
        <p className="text-sm text-[var(--muted)]">
          Execute these in staging after migrations. Each link opens the admin desk where the check runs.
        </p>
        <Card>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
            {STAGING_SMOKE_CHECKLIST.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800 hover:border-blue-200 hover:bg-blue-50/50"
              >
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  {item.label}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Escrow health</h2>
        <EscrowHealthPanel />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--foreground)]">CI safety tests</h2>
          <p className="text-xs text-[var(--muted)]">
            Published from <code className="rounded bg-black/5 px-1">npm run test:safety:publish</code> in store-link-mobile
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading safety test results…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-red-600">{error}</CardContent>
          </Card>
        ) : !latest ? (
          <Card>
            <CardContent className="py-10 text-center text-[var(--muted)]">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="font-medium">No safety test runs yet</p>
              <p className="mt-1 text-sm">
                Run <code className="rounded bg-black/5 px-1.5 py-0.5">npm run test:safety:publish</code> in
                store-link-mobile, or wire CI secrets for automatic publishes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Latest CI run</p>
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {latest.passed_tests}/{latest.total_tests} passed
                    </p>
                  </div>
                  <Badge tone={latest.status === 'passed' ? 'success' : 'danger'}>
                    {latest.status === 'passed' ? 'All passed' : `${latest.failed_tests} failed`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[var(--muted)]">Triggered by</dt>
                    <dd className="font-medium">{latest.triggered_by}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Branch</dt>
                    <dd className="font-medium">{latest.branch || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Duration</dt>
                    <dd className="font-medium">
                      {latest.duration_ms != null ? `${(latest.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">When</dt>
                    <dd className="font-medium">
                      {latest.created_at ? new Date(latest.created_at).toLocaleString() : '—'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Suites by category</h3>
              {suitesByCategory.map(([category, suites]) => (
                <Card key={category}>
                  <CardHeader>
                    <p className="font-semibold">{CATEGORY_LABELS[category] || category}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {suites.filter((s) => s.status === 'passed').length}/{suites.length} suites passed
                    </p>
                  </CardHeader>
                  <CardContent className="divide-y divide-[var(--border)] p-0">
                    {suites.map((suite) => {
                      const suiteKey = `${latest.id}-${suite.id}`
                      const open = expandedSuites[suiteKey] ?? false
                      return (
                        <div key={suiteKey}>
                          <button
                            type="button"
                            onClick={() => toggleSuite(suiteKey)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                            )}
                            {suite.status === 'passed' ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                            )}
                            <span className="flex-1 font-medium">{suite.name}</span>
                            <span className="text-sm text-[var(--muted)]">
                              {suite.passed}/{suite.passed + suite.failed} tests
                            </span>
                          </button>
                          {open && (
                            <ul className="border-t border-[var(--border)] bg-black/[0.015] px-4 py-2">
                              {suite.tests.map((test) => (
                                <li
                                  key={test.name}
                                  className="flex items-start gap-2 border-b border-[var(--border)] py-2 last:border-0"
                                >
                                  {test.status === 'passed' ? (
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : (
                                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm">{test.name}</p>
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
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            {runs.length > 1 && (
              <Card>
                <CardHeader>
                  <p className="font-semibold">Run history</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-[var(--border)]">
                    {runs.slice(1).map((run) => (
                      <li key={run.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span>{new Date(run.created_at).toLocaleString()}</span>
                        <span className="text-[var(--muted)]">
                          {run.passed_tests}/{run.total_tests} · {run.triggered_by}
                        </span>
                        <Badge tone={run.status === 'passed' ? 'success' : 'danger'}>{run.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  )
}
