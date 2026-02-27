'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { PageHeader } from '../../../components/admin/PageHeader'
import { Card, CardHeader, CardContent, Badge } from '../../../components/ui'
import { Loader2, AlertCircle, Info } from 'lucide-react'

type ObservabilityEvent = {
  id: string
  user_id: string | null
  source: string | null
  event_name: string | null
  level: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

export default function ObservabilityPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<ObservabilityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('observability_events')
      .select('id, user_id, source, event_name, level, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (levelFilter) q = q.eq('level', levelFilter)
    const { data } = await q
    setEvents((data as ObservabilityEvent[]) ?? [])
    setLoading(false)
  }, [levelFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const levelTone = (level: string | null) => {
    if (level === 'error' || level === 'critical') return 'danger'
    if (level === 'warn') return 'warning'
    return 'neutral'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observability"
        subtitle="Recent error and diagnostic events from the app and admin panel."
        actions={
          <button
            onClick={() => fetchEvents()}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Refresh
          </button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-[var(--muted)]">Filter by level</span>
            <select
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-start gap-4 px-6 py-4 hover:bg-[var(--background)]/50"
                >
                  <div className="flex items-center gap-2 min-w-[140px]">
                    {ev.level === 'error' || ev.level === 'critical' ? (
                      <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
                    ) : (
                      <Info className="h-4 w-4 text-[var(--muted)]" />
                    )}
                    <Badge tone={levelTone(ev.level) as 'success' | 'danger' | 'warning' | 'neutral'}>
                      {ev.level ?? '—'}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{ev.event_name ?? '—'}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {ev.source ?? '—'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                    </p>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <pre className="mt-2 text-xs bg-[var(--background)] p-2 rounded overflow-x-auto max-h-24 overflow-y-auto">
                        {JSON.stringify(ev.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && events.length === 0 && (
            <div className="py-12 text-center text-[var(--muted)]">No events in this range.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
