'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Activity, Eye, ExternalLink, Loader2, Users } from 'lucide-react'

import { parseApiError } from '../../utils/http'
import {
  activitySummary,
  activityTargetUrl,
  activityTypeLabel,
  type GroupedActivity,
} from '../../lib/activityFeedMirror'

type UserActivityFeedPanelProps = {
  userId: string
}

function formatWhen(iso: string) {
  const then = new Date(iso).getTime()
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`
  return new Date(iso).toLocaleString()
}

export function UserActivityFeedPanel({ userId }: UserActivityFeedPanelProps) {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayViews, setTodayViews] = useState(0)
  const [feed, setFeed] = useState<GroupedActivity[]>([])

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch(`/api/admin/users/activity-feed?userId=${encodeURIComponent(userId)}`)
    if (!response.ok) {
      const msg = await parseApiError(response, 'Could not load activity feed.')
      setError(msg)
      setLoading(false)
      return
    }
    const payload = (await response.json().catch(() => ({}))) as {
      todayViews?: number
      feed?: GroupedActivity[]
    }
    setTodayViews(Number(payload.todayViews || 0))
    setFeed(Array.isArray(payload.feed) ? payload.feed : [])
    setLoaded(true)
    setLoading(false)
  }, [userId])

  const eventRows = feed.filter((row) => row.type !== 'SECTION')

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Activity size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Recent activity</p>
            <p className="text-sm font-black text-gray-900">Mobile feed mirror</p>
          </div>
        </div>
        {loaded ? (
          <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700">
            {todayViews} profile views today
          </span>
        ) : null}
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Same event types as the mobile Activity screen — likes, comments, orders, bookings, spotlight, coins, and more.
          Load is audit-logged.
        </p>

        {!loaded ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadFeed()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Load activity feed
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadFeed()}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Refresh feed
          </button>
        )}

        {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

        {loaded && eventRows.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No activity events found for this user.</p>
        ) : null}

        {feed.length > 0 ? (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-indigo-100 bg-white divide-y divide-gray-100">
            {feed.map((row, index) => {
              if (row.type === 'SECTION') {
                return (
                  <div
                    key={`${row.id}-${index}`}
                    className="px-3 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {row.sectionLabel}
                  </div>
                )
              }

              const targetUrl = activityTargetUrl(row)
              const sender = row.senders[0]

              return (
                <div key={`${row.id}-${index}`} className="px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                      {activityTypeLabel(row.type)}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatWhen(row.created_at)}</span>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">{activitySummary(row, userId)}</p>
                  {row.products?.name ? (
                    <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">On {row.products.name}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-3 text-[10px]">
                    {targetUrl ? (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open target
                      </a>
                    ) : null}
                    {row.type === 'ORDER' ? (
                      <Link
                        href={`/dashboard/orders?q=${row.id}`}
                        className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600 hover:underline"
                      >
                        Order in admin
                      </Link>
                    ) : null}
                    {sender?.id ? (
                      <Link
                        href={`/dashboard/users?q=${sender.id}`}
                        className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600 hover:underline"
                      >
                        Actor @{sender.slug || sender.id.slice(0, 8)}
                      </Link>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
