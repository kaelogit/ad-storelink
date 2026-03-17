'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { Card, CardHeader, CardContent } from '../../../components/ui'
import { Loader2 } from 'lucide-react'

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

export default function ExperimentsDashboardPage() {
  const supabase = createClient()
  const [homeRows, setHomeRows] = useState<HomeSessionRow[] | null>(null)
  const [exploreRows, setExploreRows] = useState<ExploreSessionRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: homeData } = await supabase.rpc('rpc_experiment_home_summary')
      const { data: exploreData } = await supabase.rpc('rpc_experiment_explore_summary')

      setHomeRows((homeData as HomeSessionRow[]) ?? [])
      setExploreRows((exploreData as ExploreSessionRow[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [supabase])

  const hasHome = useMemo(() => (homeRows?.length ?? 0) > 0, [homeRows])
  const hasExplore = useMemo(() => (exploreRows?.length ?? 0) > 0, [exploreRows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiments"
        subtitle="Session-level metrics for Home and Explore ranking experiments."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Home feed – home_feed_rank_v1</h2>
                  <p className="text-xs text-[var(--muted)]">
                    Compare variants by duration, items seen, add-to-cart, and service booking intent.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasHome ? (
                <div className="py-8 text-center text-xs text-[var(--muted)]">
                  No Home sessions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">Variant</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Sessions</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Avg time</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Items / session</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Clicks</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Add to cart</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Book requests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homeRows!.map((row) => (
                        <tr key={row.variant} className="border-b border-[var(--border)]/60 last:border-0">
                          <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.variant}</td>
                          <td className="px-3 py-2 text-right">{row.sessions}</td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_duration_ms != null ? `${Math.round(row.avg_duration_ms / 1000)}s` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_items_seen != null ? row.avg_items_seen.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_clicks != null ? row.avg_clicks.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_add_to_cart != null ? row.avg_add_to_cart.toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_service_book_requests != null ? row.avg_service_book_requests.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Explore feed – explore_feed_rank_v1</h2>
                  <p className="text-xs text-[var(--muted)]">
                    Compare variants by session duration, items seen, profile taps, and product clicks.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasExplore ? (
                <div className="py-8 text-center text-xs text-[var(--muted)]">
                  No Explore sessions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">Variant</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Sessions</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Avg time</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Items / session</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Profile taps</th>
                        <th className="px-3 py-2 text-right font-medium text-[var(--muted)]">Product clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exploreRows!.map((row) => (
                        <tr key={row.variant} className="border-b border-[var(--border)]/60 last:border-0">
                          <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.variant}</td>
                          <td className="px-3 py-2 text-right">{row.sessions}</td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_duration_ms != null ? `${Math.round(row.avg_duration_ms / 1000)}s` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_items_seen != null ? row.avg_items_seen.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_profile_taps != null ? row.avg_profile_taps.toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.avg_product_clicks != null ? row.avg_product_clicks.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

