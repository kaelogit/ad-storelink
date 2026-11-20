'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrainCircuit, Loader2, RefreshCcw, Sparkles } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { ActionReasonModal } from '../../../components/admin/ActionReasonModal'
import { StatusBadge } from '../../../components/admin/StatusBadge'
import { Card, CardContent, CardHeader } from '../../../components/ui'
import { parseApiError } from '../../../utils/http'
import { useAdminRole } from '../../../hooks/useAdminRole'

type Coverage = {
  active_products: number
  embedded_products: number
  missing_products: number
  active_services: number
  embedded_services: number
  missing_services: number
  updated_at?: string
}

type MissingProduct = { id: string; name: string | null; description: string | null }
type MissingService = {
  id: string
  title: string | null
  description: string | null
  service_category: string | null
}

type MissingSample = {
  products: MissingProduct[]
  services: MissingService[]
  productsError?: string | null
  servicesError?: string | null
}

type RunResult = {
  totalProcessed: number
  results: { target: string; processed: number; error?: string }[]
  coverage?: Coverage
}

type PendingRun =
  | { kind: 'keep' }
  | { kind: 'batch'; target: 'products' | 'services' | 'both'; batches: number }

const RUN_REASON_CATEGORIES = [
  { value: 'catalog_import', label: 'Catalog import / backfill' },
  { value: 'search_quality', label: 'Search quality fix' },
  { value: 'post_deploy', label: 'Post-deploy catch-up' },
  { value: 'routine', label: 'Routine maintenance' },
  { value: 'other', label: 'Other' },
]

export default function SearchEmbeddingsPage() {
  const { role, loading: roleLoading } = useAdminRole()
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [missingSample, setMissingSample] = useState<MissingSample | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<'products' | 'services' | 'both' | 'keep' | 'catchup' | null>(null)
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const canRun = role === 'super_admin'

  const missingTotal = useMemo(
    () => (coverage?.missing_products ?? 0) + (coverage?.missing_services ?? 0),
    [coverage],
  )
  const caughtUp = Boolean(coverage && missingTotal === 0)

  const loadCoverage = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/search-embeddings/stats')
      if (!response.ok) {
        setFeedback({ tone: 'error', message: await parseApiError(response, 'Could not load embedding stats.') })
        return
      }
      const payload = (await response.json()) as {
        coverage: Coverage
        missingSample?: MissingSample
      }
      setCoverage(payload.coverage)
      setMissingSample(payload.missingSample ?? null)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not load embedding stats.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (roleLoading) return
    if (canRun) void loadCoverage()
    else setLoading(false)
  }, [canRun, loadCoverage, roleLoading])

  const runBatch = async (
    target: 'products' | 'services' | 'both',
    batches: number,
    reason: string,
    runKey: 'products' | 'services' | 'both' | 'catchup' = target,
  ): Promise<RunResult | null> => {
    setRunning(runKey)
    setFeedback({
      tone: 'info',
      message:
        batches > 1
          ? `Running ${batches}× ${target} embedding batches…`
          : `Running ${target} embedding batch…`,
    })

    try {
      const response = await fetch('/api/admin/search-embeddings/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `search-embeddings-${target}-${Date.now()}`,
        },
        body: JSON.stringify({ target, limit: 50, batches, reason }),
      })

      if (!response.ok) {
        setFeedback({ tone: 'error', message: await parseApiError(response, 'Embedding run failed.') })
        return null
      }

      const payload = (await response.json()) as RunResult
      if (payload.coverage) setCoverage(payload.coverage)
      // Refresh the missing sample after a run so the list stays honest.
      void loadCoverage()

      const errors = (payload.results ?? [])
        .filter((row) => row.error)
        .map((row) => `${row.target}: ${row.error}`)
      const detail = (payload.results ?? [])
        .map((row) => `${row.target}: ${row.processed}${row.error ? ` (${row.error})` : ''}`)
        .join(' · ')

      if (errors.length > 0) {
        setFeedback({
          tone: 'error',
          message: `Embedding error — embedded ${payload.totalProcessed} item(s). ${errors.join(' · ')}`,
        })
      } else {
        setFeedback({
          tone: payload.totalProcessed > 0 ? 'success' : 'info',
          message:
            payload.totalProcessed > 0
              ? `Embedded ${payload.totalProcessed} item(s). ${detail}`
              : `Nothing left to embed for that run. ${detail || 'Catalog may be empty or already caught up.'}`,
        })
      }
      return payload
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Embedding run failed.' })
      return null
    } finally {
      setRunning(null)
    }
  }

  const keepEmbedding = async (reason: string) => {
    setRunning('keep')
    let total = 0
    const maxLoops = 30

    try {
      for (let i = 0; i < maxLoops; i += 1) {
        setFeedback({
          tone: 'info',
          message: `Keeping embeddings current… batch ${i + 1}/${maxLoops}`,
        })

        const response = await fetch('/api/admin/search-embeddings/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': `search-embeddings-keep-${Date.now()}-${i}`,
          },
          body: JSON.stringify({ target: 'both', limit: 50, batches: 1, reason }),
        })

        if (!response.ok) {
          setFeedback({ tone: 'error', message: await parseApiError(response, 'Embedding run failed.') })
          return
        }

        const payload = (await response.json()) as RunResult
        if (payload.coverage) setCoverage(payload.coverage)
        total += payload.totalProcessed ?? 0

        const missing =
          (payload.coverage?.missing_products ?? 0) + (payload.coverage?.missing_services ?? 0)
        const errorDetail = (payload.results ?? [])
          .filter((row) => row.error)
          .map((row) => `${row.target}: ${row.error}`)
          .join(' · ')
        if (errorDetail || payload.totalProcessed === 0 || missing === 0) {
          setFeedback({
            tone: errorDetail ? 'error' : 'success',
            message: errorDetail
              ? `Stopped after an embedding error. Embedded ${total} item(s) this session. ${errorDetail}`
              : missing === 0
                ? `Catalog is caught up. Embedded ${total} item(s) this session.`
                : `Nothing left in the queue. Embedded ${total} item(s) this session.`,
          })
          void loadCoverage()
          return
        }
      }

      setFeedback({
        tone: 'info',
        message: `Paused after ${maxLoops} batches (${total} embedded). Click again if Missing is still above zero.`,
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: `${err instanceof Error ? err.message : 'Embedding run failed.'}${
          total > 0 ? ` Embedded ${total} item(s) before the failure.` : ''
        }`,
      })
    } finally {
      setRunning(null)
    }
  }

  const confirmRun = async ({ category, reason }: { category: string; reason: string }) => {
    const pending = pendingRun
    if (!pending) return
    const fullReason = `[${category}] ${reason}`
    setPendingRun(null)
    if (pending.kind === 'keep') {
      await keepEmbedding(fullReason)
    } else {
      const runKey =
        pending.batches > 1 && pending.target === 'both' ? 'catchup' : pending.target
      await runBatch(pending.target, pending.batches, fullReason, runKey)
    }
  }

  if (roleLoading) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Search AI" subtitle="Semantic search embedding maintenance" />
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking permissions…
        </div>
      </div>
    )
  }

  if (!canRun) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Search AI" subtitle="Semantic search embedding maintenance" />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Super Admin only. Embedding runs call Gemini edge functions against the live catalog.
        </p>
      </div>
    )
  }

  const busy = !!running
  const missingProducts = coverage?.missing_products ?? 0
  const missingServices = coverage?.missing_services ?? 0

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Search AI"
        subtitle="Build Gemini vectors for products and services so unified search understands natural phrases."
        actions={
          <button
            type="button"
            onClick={() => void loadCoverage()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      {!loading && coverage ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            caughtUp
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          {caughtUp ? (
            <>
              <strong>Caught up.</strong> All active products and services have embeddings. Cron keeps new
              listings filled in the background.
            </>
          ) : (
            <>
              <strong>{missingTotal} missing</strong>
              {missingProducts > 0 ? ` · ${missingProducts} products` : ''}
              {missingServices > 0 ? ` · ${missingServices} services` : ''}
              . Run <em>Keep embedding until caught up</em> after a catalog dump, or wait for the hourly cron.
            </>
          )}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-zinc-700" />
            <h2 className="text-base font-semibold text-zinc-900">Coverage</h2>
          </div>
          {coverage?.updated_at ? (
            <p className="text-[11px] text-zinc-400">
              Updated {new Date(coverage.updated_at).toLocaleString()}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {loading && !coverage ? (
            <div className="col-span-2 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats…
            </div>
          ) : (
            <>
              <CoverageCard
                label="Products"
                active={coverage?.active_products ?? 0}
                embedded={coverage?.embedded_products ?? 0}
                missing={missingProducts}
              />
              <CoverageCard
                label="Services"
                active={coverage?.active_services ?? 0}
                embedded={coverage?.embedded_services ?? 0}
                missing={missingServices}
              />
            </>
          )}
        </CardContent>
      </Card>

      {!loading && missingTotal > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-zinc-900">Missing embeddings (active only)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Deleted / inactive listings are excluded from Missing. These are live catalog rows still
              waiting for a Gemini vector.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(missingSample?.products?.length ?? 0) > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Products
                </p>
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {missingSample!.products.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {p.name?.trim() || 'Untitled product'}
                        </p>
                        <p className="truncate font-mono text-[10px] text-zinc-400">{p.id}</p>
                      </div>
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : missingProducts > 0 ? (
              <p className="text-xs text-amber-800">
                Coverage says {missingProducts} products missing, but the sample list is empty
                {missingSample?.productsError ? ` (${missingSample.productsError})` : ''}.
              </p>
            ) : null}

            {(missingSample?.services?.length ?? 0) > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Services
                </p>
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {missingSample!.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {s.title?.trim() || 'Untitled service'}
                        </p>
                        <p className="truncate font-mono text-[10px] text-zinc-400">{s.id}</p>
                      </div>
                      <Link
                        href={`/dashboard/service-listings/${s.id}`}
                        className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-zinc-900">Run embedding batches</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600">
            Each batch embeds up to 50 listings missing vectors. Prefer{' '}
            <strong>Keep embedding until caught up</strong> after a big dump — it loops until Missing is 0
            (max 30 batches). Every run asks for a reason and is audit-logged.
          </p>

          <div className="flex flex-wrap gap-2">
            <RunButton
              label="Keep embedding until caught up"
              loading={running === 'keep'}
              disabled={busy || caughtUp}
              emphasis
              onClick={() => setPendingRun({ kind: 'keep' })}
            />
            <RunButton
              label="Embed 50 products"
              loading={running === 'products'}
              disabled={busy || missingProducts === 0}
              onClick={() => setPendingRun({ kind: 'batch', target: 'products', batches: 1 })}
            />
            <RunButton
              label="Embed 50 services"
              loading={running === 'services'}
              disabled={busy || missingServices === 0}
              onClick={() => setPendingRun({ kind: 'batch', target: 'services', batches: 1 })}
            />
            <RunButton
              label="Embed both (50 each)"
              loading={running === 'both'}
              disabled={busy || caughtUp}
              onClick={() => setPendingRun({ kind: 'batch', target: 'both', batches: 1 })}
            />
            <RunButton
              label="Catch up (5× batches)"
              loading={running === 'catchup'}
              disabled={busy || caughtUp}
              variant="secondary"
              onClick={() => setPendingRun({ kind: 'batch', target: 'both', batches: 5 })}
            />
          </div>

          {caughtUp ? (
            <p className="text-xs text-zinc-500">
              All catch-up actions are idle while Missing is zero. Refresh after new listings go live.
            </p>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-600">
            <p className="font-semibold text-zinc-800">Ops checklist</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>
                Admin server needs <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code>
              </li>
              <li>
                Edge functions deployed:{' '}
                <code className="rounded bg-white px-1">generate-product-embeddings</code>,{' '}
                <code className="rounded bg-white px-1">generate-service-embeddings</code>
              </li>
              <li>Hourly cron: products :10 UTC · services :25 UTC</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <ActionReasonModal
        open={pendingRun !== null}
        title={pendingRun?.kind === 'keep' ? 'Keep embedding until caught up?' : 'Run embedding batch?'}
        description="Calls Gemini embedding edge functions against live catalog data. This action is recorded in the admin audit log."
        impactSummary={
          pendingRun?.kind === 'keep'
            ? `Runs up to 30 batches of 50 listings each until Missing is 0. Current gap: ${missingTotal}.`
            : pendingRun
              ? `Processes up to 50 ${
                  pendingRun.target === 'both' ? 'products and 50 services' : pendingRun.target
                }${pendingRun.batches > 1 ? ` per batch × ${pendingRun.batches}` : ''}.`
              : undefined
        }
        categoryOptions={RUN_REASON_CATEGORIES}
        onClose={() => {
          if (busy) return
          setPendingRun(null)
        }}
        onSubmit={confirmRun}
      />
    </div>
  )
}

function CoverageCard({
  label,
  active,
  embedded,
  missing,
}: {
  label: string
  active: number
  embedded: number
  missing: number
}) {
  const pct = active > 0 ? Math.min(100, Math.round((embedded / active) * 100)) : 100
  const healthy = missing === 0

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        <StatusBadge
          label={healthy ? 'Caught up' : `${missing} missing`}
          tone={healthy ? 'success' : 'warning'}
        />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-zinc-500">
        {pct}% embedded · {embedded} / {active} active
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 px-2 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Active</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">{active}</dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Embedded</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">{embedded}</dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Missing</dt>
          <dd
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              missing > 0 ? 'text-amber-700' : 'text-zinc-700'
            }`}
          >
            {missing}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function RunButton({
  label,
  onClick,
  loading,
  disabled,
  variant = 'primary',
  emphasis = false,
}: {
  label: string
  onClick: () => void
  loading: boolean
  disabled: boolean
  variant?: 'primary' | 'secondary'
  emphasis?: boolean
}) {
  const base = emphasis
    ? 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
    : variant === 'primary'
      ? 'border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800'
      : 'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${base}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  )
}
