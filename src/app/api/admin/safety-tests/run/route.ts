import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'
import { createServiceSupabaseClient } from '../../../../../utils/supabase/service'

type ProbeCase = {
  name: string
  status: 'passed' | 'failed'
  duration_ms: number
  failureMessages?: string[]
}

type RunMode = 'live' | 'ci'

async function probe(name: string, fn: () => Promise<void>): Promise<ProbeCase> {
  const started = Date.now()
  try {
    await fn()
    return { name, status: 'passed', duration_ms: Date.now() - started }
  } catch (error) {
    return {
      name,
      status: 'failed',
      duration_ms: Date.now() - started,
      failureMessages: [error instanceof Error ? error.message : String(error)],
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function runLiveProbes(): Promise<ProbeCase[]> {
  const service = createServiceSupabaseClient()

  return Promise.all([
    probe('Database reachable', async () => {
      const { error } = await service.from('profiles').select('id').limit(1)
      if (error) throw new Error(error.message)
    }),
    probe('Product category column exists', async () => {
      const { error } = await service.from('products').select('id, category').limit(1)
      if (error) throw new Error(error.message)
    }),
    probe('Canonicalize product category aliases', async () => {
      const { data, error } = await service.rpc('canonicalize_product_category', {
        p_slug: 'Health & Beauty',
      })
      if (error) throw new Error(error.message)
      assert(data === 'beauty', `expected beauty, got ${String(data)}`)
    }),
    probe('Events services sit under Events product leaf', async () => {
      const { data, error } = await service.rpc('service_slugs_for_product_leaf', {
        p_leaf: 'events',
      })
      if (error) throw new Error(error.message)
      const slugs = Array.isArray(data) ? data : []
      assert(slugs.includes('photographer'), `photographer missing from events leaf: ${slugs.join(',')}`)
      assert(!slugs.includes('device_repair'), 'device_repair should not be under events')
    }),
    probe('Home leaf is trades only (no photographer/catering)', async () => {
      const { data, error } = await service.rpc('service_slugs_for_product_leaf', {
        p_leaf: 'home',
      })
      if (error) throw new Error(error.message)
      const slugs = Array.isArray(data) ? data : []
      assert(slugs.includes('plumber'), 'plumber should be under home')
      assert(!slugs.includes('photographer'), 'photographer should not be under home')
      assert(!slugs.includes('catering'), 'catering should not be under home')
    }),
    probe('Food leaf includes catering', async () => {
      const { data, error } = await service.rpc('service_slugs_for_product_leaf', {
        p_leaf: 'food',
      })
      if (error) throw new Error(error.message)
      const slugs = Array.isArray(data) ? data : []
      assert(slugs.includes('catering'), `catering missing from food leaf: ${slugs.join(',')}`)
    }),
    probe('Search embedding coverage RPC', async () => {
      const { data, error } = await service.rpc('get_search_embedding_coverage')
      if (error) throw new Error(error.message)
      assert(data && typeof data === 'object', 'coverage payload missing')
    }),
  ])
}

async function triggerCiWorkflow() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const workflow = process.env.GITHUB_SAFETY_WORKFLOW || 'safety-tests.yml'
  const ref = process.env.GITHUB_SAFETY_REF || 'main'

  if (!token || !repo) {
    throw new Error(
      'CI trigger is not configured. Set GITHUB_TOKEN and GITHUB_REPO (owner/name) on the admin server.',
    )
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GitHub dispatch failed (${response.status}): ${detail || response.statusText}`)
  }
}

export async function POST(request: Request) {
  const auth = await getApiAdminContext(['super_admin'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as { mode?: RunMode }
  const mode: RunMode = body.mode === 'ci' ? 'ci' : 'live'
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim()
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'x-idempotency-key header is required' }, { status: 400 })
  }

  const { data: existingIdempotent } = await auth.supabase
    .from('admin_audit_logs')
    .select('id')
    .eq('action_type', 'SAFETY_TESTS_RUN')
    .eq('target_id', mode)
    .eq('details->>idempotencyKey', idempotencyKey)
    .limit(1)
    .maybeSingle()

  if (existingIdempotent) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  if (mode === 'ci') {
    try {
      await triggerCiWorkflow()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger CI'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    await auth.supabase.from('admin_audit_logs').insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action_type: 'SAFETY_TESTS_RUN',
      target_id: 'ci',
      details: { mode: 'ci', idempotencyKey },
    })

    return NextResponse.json({
      ok: true,
      mode: 'ci',
      message: 'CI safety suite dispatched. Results appear here after GitHub finishes.',
    })
  }

  const started = Date.now()
  let tests: ProbeCase[]
  try {
    tests = await runLiveProbes()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live probes failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const passed = tests.filter((t) => t.status === 'passed').length
  const failed = tests.filter((t) => t.status === 'failed').length
  const status = failed > 0 ? 'failed' : 'passed'
  const suite = {
    id: 'live-probes',
    name: 'Live production probes',
    category: 'infra',
    status,
    passed,
    failed,
    skipped: 0,
    duration_ms: Date.now() - started,
    tests,
  }

  const { data: inserted, error: insertError } = await auth.supabase
    .from('safety_test_runs')
    .insert({
      repo: 'live-probes',
      branch: null,
      commit_sha: null,
      triggered_by: auth.email || 'admin',
      status,
      total_tests: tests.length,
      passed_tests: passed,
      failed_tests: failed,
      skipped_tests: 0,
      duration_ms: Date.now() - started,
      suites: [suite],
    })
    .select(
      'id, repo, branch, commit_sha, triggered_by, status, total_tests, passed_tests, failed_tests, skipped_tests, duration_ms, suites, created_at',
    )
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  await auth.supabase.from('admin_audit_logs').insert({
    admin_id: auth.userId,
    admin_email: auth.email,
    action_type: 'SAFETY_TESTS_RUN',
    target_id: 'live',
    details: {
      mode: 'live',
      status,
      passed,
      failed,
      idempotencyKey,
      runId: inserted?.id,
    },
  })

  return NextResponse.json({ ok: true, mode: 'live', run: inserted })
}
