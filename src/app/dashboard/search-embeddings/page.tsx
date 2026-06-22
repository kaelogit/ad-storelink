'use client'

import { useCallback, useEffect, useState } from 'react'
import { BrainCircuit, Loader2, RefreshCcw, Sparkles } from 'lucide-react'
import { PageHeader } from '../../../components/admin/PageHeader'
import { ActionFeedback } from '../../../components/admin/ActionFeedback'
import { Card, CardContent, CardHeader } from '../../../components/ui'
import { parseApiError } from '../../../utils/http'
import type { AdminRole } from '../../../types/admin'
import { createClient } from '../../../utils/supabase/client'

type Coverage = {
  active_products: number
  embedded_products: number
  missing_products: number
  active_services: number
  embedded_services: number
  missing_services: number
  updated_at?: string
}

type RunResult = {
  totalProcessed: number
  results: { target: string; processed: number; error?: string }[]
  coverage?: Coverage
}

export default function SearchEmbeddingsPage() {
  const supabase = createClient()
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<'products' | 'services' | 'both' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)

  const canRun = adminRole === 'super_admin'

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('admin_users').select('role').eq('id', user.id).maybeSingle()
      if (mounted && data?.role) setAdminRole(data.role as AdminRole)
    }
    void loadRole()
    return () => {
      mounted = false
    }
  }, [supabase])

  const loadCoverage = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/search-embeddings/stats')
    if (!response.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(response, 'Could not load embedding stats.') })
      setLoading(false)
      return
    }
    const payload = (await response.json()) as { coverage: Coverage }
    setCoverage(payload.coverage)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (canRun) void loadCoverage()
    else setLoading(false)
  }, [canRun, loadCoverage])

  const runBatch = async (target: 'products' | 'services' | 'both', batches = 1) => {
    setRunning(target)
    setFeedback({ tone: 'info', message: `Running ${target} embedding batch…` })

    const response = await fetch('/api/admin/search-embeddings/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': `search-embeddings-${target}-${Date.now()}`,
      },
      body: JSON.stringify({ target, limit: 50, batches }),
    })

    if (!response.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(response, 'Embedding run failed.') })
      setRunning(null)
      return
    }

    const payload = (await response.json()) as RunResult
    if (payload.coverage) setCoverage(payload.coverage)

    const detail = payload.results
      .map((row) => `${row.target}: ${row.processed}${row.error ? ` (${row.error})` : ''}`)
      .join(' · ')

    setFeedback({
      tone: payload.totalProcessed > 0 ? 'success' : 'info',
      message:
        payload.totalProcessed > 0
          ? `Embedded ${payload.totalProcessed} item(s). ${detail}`
          : `Nothing left to embed for that run. ${detail || 'Catalog may be empty or already caught up.'}`,
    })
    setRunning(null)
  }

  if (adminRole && adminRole !== 'super_admin') {
    return (
      <div className="space-y-4">
        <PageHeader title="Search AI" subtitle="Semantic search embedding maintenance" />
        <p className="text-sm text-gray-600">Super admin only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search AI"
        subtitle="Build Gemini vectors for products and services so unified search understands natural phrases."
        actions={
          <button
            type="button"
            onClick={() => void loadCoverage()}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh stats
          </button>
        }
      />

      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <BrainCircuit className="h-5 w-5 text-violet-600" />
          <h2 className="text-base font-semibold">Coverage</h2>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {loading ? (
            <div className="col-span-2 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats…
            </div>
          ) : (
            <>
              <StatBlock
                label="Products"
                active={coverage?.active_products ?? 0}
                embedded={coverage?.embedded_products ?? 0}
                missing={coverage?.missing_products ?? 0}
              />
              <StatBlock
                label="Services"
                active={coverage?.active_services ?? 0}
                embedded={coverage?.embedded_services ?? 0}
                missing={coverage?.missing_services ?? 0}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold">Run embedding batches</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Each click processes up to 50 listings that are missing embeddings. Run again while{' '}
            <strong>Missing</strong> is above zero — especially after sellers add new products or services.
          </p>
          <div className="flex flex-wrap gap-3">
            <RunButton
              label="Embed 50 products"
              loading={running === 'products'}
              disabled={!!running}
              onClick={() => void runBatch('products')}
            />
            <RunButton
              label="Embed 50 services"
              loading={running === 'services'}
              disabled={!!running}
              onClick={() => void runBatch('services')}
            />
            <RunButton
              label="Embed both (50 each)"
              loading={running === 'both'}
              disabled={!!running}
              onClick={() => void runBatch('both')}
            />
            <RunButton
              label="Catch up (5× batches)"
              loading={running === 'both'}
              disabled={!!running}
              variant="secondary"
              onClick={() => void runBatch('both', 5)}
            />
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
            <li>Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> on the admin server.</li>
            <li>Edge functions must be deployed: <code>generate-product-embeddings</code>, <code>generate-service-embeddings</code>.</li>
            <li>New listings stay on keyword search until you run a batch here (automatic cron is backlog #102).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function StatBlock({
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
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="text-xs text-gray-500">Active</dt>
          <dd className="font-bold text-gray-900">{active}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Embedded</dt>
          <dd className="font-bold text-emerald-700">{embedded}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Missing</dt>
          <dd className={`font-bold ${missing > 0 ? 'text-amber-700' : 'text-gray-700'}`}>{missing}</dd>
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
}: {
  label: string
  onClick: () => void
  loading: boolean
  disabled: boolean
  variant?: 'primary' | 'secondary'
}) {
  const base =
    variant === 'primary'
      ? 'bg-gray-900 text-white hover:bg-gray-800'
      : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${base}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  )
}
