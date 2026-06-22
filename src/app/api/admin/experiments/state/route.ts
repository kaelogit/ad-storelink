import { NextResponse } from 'next/server'
import { getApiAdminContext } from '../../../../../utils/auth/apiAdmin'

export async function GET(request: Request) {
  const auth = await getApiAdminContext(['super_admin', 'analyst'])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const homeKey = url.searchParams.get('homeKey') || 'home_feed_rank_v1'
  const exploreKey = url.searchParams.get('exploreKey') || 'explore_feed_rank_v1'

  const [{ data: state, error: stateError }, { data: homeSummary }, { data: exploreSummary }] =
    await Promise.all([
      auth.supabase.rpc('get_admin_ranking_rollout_state'),
      auth.supabase.rpc('rpc_experiment_home_summary', { p_experiment_key: homeKey }),
      auth.supabase.rpc('rpc_experiment_explore_summary', { p_experiment_key: exploreKey }),
    ])

  if (stateError) {
    return NextResponse.json({ error: stateError.message }, { status: 400 })
  }

  return NextResponse.json({
    state: state ?? {},
    homeSummary: homeSummary ?? [],
    exploreSummary: exploreSummary ?? [],
    homeKey,
    exploreKey,
    role: auth.role,
  })
}
