'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Eye, Heart, Loader2 } from 'lucide-react'
import { parseApiError } from '../../utils/http'

type SocialEngagementRow = {
  entry_id: string
  source_type: 'product' | 'service' | 'reel' | 'spotlight'
  target_id: string
  target_title: string | null
  target_slug: string | null
  seller_id: string | null
  seller_slug: string | null
  created_at: string | null
}

type Tab = 'saves' | 'likes'

const PAGE_SIZE = 25

const SOURCE_LABELS: Record<SocialEngagementRow['source_type'], string> = {
  product: 'Product',
  service: 'Service',
  reel: 'Reel',
  spotlight: 'Spotlight',
}

function targetUrl(row: SocialEngagementRow) {
  const slug = row.target_slug || row.target_id
  switch (row.source_type) {
    case 'product':
      return `https://storelink.ng/p/${encodeURIComponent(slug)}`
    case 'service':
      return `https://storelink.ng/service/${encodeURIComponent(slug)}`
    case 'reel':
      return `https://storelink.ng/r/${encodeURIComponent(slug)}`
    case 'spotlight':
      return `https://storelink.ng/sp/${encodeURIComponent(row.target_id)}`
    default:
      return '#'
  }
}

type UserSocialEngagementPanelProps = {
  userId: string
}

export function UserSocialEngagementPanel({ userId }: UserSocialEngagementPanelProps) {
  const [tab, setTab] = useState<Tab>('saves')
  const [saves, setSaves] = useState<SocialEngagementRow[]>([])
  const [likes, setLikes] = useState<SocialEngagementRow[]>([])
  const [savesOffset, setSavesOffset] = useState(0)
  const [likesOffset, setLikesOffset] = useState(0)
  const [savesHasMore, setSavesHasMore] = useState(false)
  const [likesHasMore, setLikesHasMore] = useState(false)
  const [savesLoaded, setSavesLoaded] = useState(false)
  const [likesLoaded, setLikesLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSaves = useCallback(
    async (reset = false) => {
      setLoading(true)
      setError(null)
      const offset = reset ? 0 : savesOffset
      const params = new URLSearchParams({
        userId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const response = await fetch(`/api/admin/users/social-saves?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Could not load saves.')
        setError(msg)
        setLoading(false)
        return
      }
      const payload = (await response.json().catch(() => ({}))) as { rows?: SocialEngagementRow[] }
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      setSaves((prev) => (reset ? rows : [...prev, ...rows]))
      setSavesOffset(offset + rows.length)
      setSavesHasMore(rows.length >= PAGE_SIZE)
      setSavesLoaded(true)
      setLoading(false)
    },
    [savesOffset, userId],
  )

  const loadLikes = useCallback(
    async (reset = false) => {
      setLoading(true)
      setError(null)
      const offset = reset ? 0 : likesOffset
      const params = new URLSearchParams({
        userId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const response = await fetch(`/api/admin/users/social-likes?${params.toString()}`)
      if (!response.ok) {
        const msg = await parseApiError(response, 'Could not load likes.')
        setError(msg)
        setLoading(false)
        return
      }
      const payload = (await response.json().catch(() => ({}))) as { rows?: SocialEngagementRow[] }
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      setLikes((prev) => (reset ? rows : [...prev, ...rows]))
      setLikesOffset(offset + rows.length)
      setLikesHasMore(rows.length >= PAGE_SIZE)
      setLikesLoaded(true)
      setLoading(false)
    },
    [likesOffset, userId],
  )

  const switchTab = (next: Tab) => {
    setTab(next)
    setError(null)
    if (next === 'saves' && !savesLoaded) void loadSaves(true)
    if (next === 'likes' && !likesLoaded) void loadLikes(true)
  }

  const rows = tab === 'saves' ? saves : likes
  const hasMore = tab === 'saves' ? savesHasMore : likesHasMore
  const loaded = tab === 'saves' ? savesLoaded : likesLoaded

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
      active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-rose-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
            <Heart size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Social engagement</p>
            <p className="text-sm font-black text-gray-900">Saves & likes sample</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Read-only paginated samples for fraud or harassment investigations. Each page load is audit-logged — no bulk export.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabClass(tab === 'saves')} onClick={() => switchTab('saves')}>
            <span className="inline-flex items-center gap-1">
              <Bookmark size={12} /> Saves
            </span>
          </button>
          <button type="button" className={tabClass(tab === 'likes')} onClick={() => switchTab('likes')}>
            <span className="inline-flex items-center gap-1">
              <Heart size={12} /> Likes
            </span>
          </button>
        </div>

        {!loaded ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void (tab === 'saves' ? loadSaves(true) : loadLikes(true))}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Load {tab === 'saves' ? 'saves' : 'likes'}
          </button>
        ) : null}

        {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

        {loaded && rows.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No {tab} found for this user.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-rose-100 bg-white divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={`${tab}-${row.entry_id}`} className="px-3 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                    {SOURCE_LABELS[row.source_type]}
                  </span>
                  {row.created_at ? (
                    <span className="text-[10px] text-gray-400">{new Date(row.created_at).toLocaleString()}</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Date unknown</span>
                  )}
                </div>
                <p className="mt-1 font-semibold text-gray-900 line-clamp-2">
                  {row.target_title || row.target_id.slice(0, 8)}
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-[10px]">
                  <a
                    href={targetUrl(row)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Eye className="h-3 w-3" /> Open
                  </a>
                  {row.seller_id ? (
                    <Link
                      href={`/dashboard/users?q=${row.seller_id}`}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600 hover:underline"
                    >
                      Seller @{row.seller_slug || row.seller_id.slice(0, 8)}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {loaded && hasMore ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void (tab === 'saves' ? loadSaves(false) : loadLikes(false))}
            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
