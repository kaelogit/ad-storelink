import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))

  const { data: runs, error } = await auth.supabase
    .from('safety_test_runs')
    .select(
      'id, repo, branch, commit_sha, triggered_by, status, total_tests, passed_tests, failed_tests, skipped_tests, duration_ms, suites, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ runs: runs ?? [] })
}
