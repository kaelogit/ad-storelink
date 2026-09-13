'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'
import { ActionFeedback } from './ActionFeedback'
import { parseApiError } from '../../utils/http'

type Announcement = {
  id: string
  title: string
  body: string
  segment: string
  scheduled_at: string
  status: string
  sent_at?: string | null
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function AnnouncementsCalendarPanel() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [segment, setSegment] = useState('ALL')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingSend, setPendingSend] = useState<Announcement | null>(null)
  const [busy, setBusy] = useState(false)

  const range = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [cursor])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from: range.from, to: range.to })
    const res = await fetch(`/api/admin/content/announcements?${params}`)
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Failed to load calendar.') })
      setLoading(false)
      return
    }
    const data = await res.json()
    setRows(Array.isArray(data.announcements) ? data.announcements : [])
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => {
    const map: Record<string, Announcement[]> = {}
    for (const row of rows) {
      const key = ymdLocal(new Date(row.scheduled_at))
      if (!map[key]) map[key] = []
      map[key].push(row)
    }
    return map
  }, [rows])

  const schedule = async () => {
    if (!title.trim() || !body.trim() || !scheduledAt) return
    setSaving(true)
    const res = await fetch('/api/admin/content/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim(),
        segment,
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Schedule failed.') })
      setSaving(false)
      return
    }
    setFeedback({ tone: 'success', message: 'Announcement scheduled.' })
    setTitle('')
    setBody('')
    setScheduledAt('')
    setSaving(false)
    await load()
  }

  const runAction = async (id: string, action: 'cancel' | 'send_now') => {
    setBusy(true)
    const res = await fetch('/api/admin/content/announcements/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: await parseApiError(res, 'Action failed.') })
      setBusy(false)
      setPendingSend(null)
      return
    }
    setFeedback({
      tone: 'success',
      message: action === 'send_now' ? 'Broadcast sent.' : 'Announcement cancelled.',
    })
    setBusy(false)
    setPendingSend(null)
    await load()
  }

  const dim = daysInMonth(cursor)
  const firstDow = startOfMonth(cursor).getDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ]

  return (
    <div className="space-y-4">
      {feedback ? <ActionFeedback tone={feedback.tone} message={feedback.message} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900">
                {cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
              >
                Next
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="p-1 text-center font-semibold text-gray-400">
                  {d}
                </div>
              ))}
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="min-h-[72px] rounded bg-gray-50" />
                const key = ymdLocal(new Date(cursor.getFullYear(), cursor.getMonth(), day))
                const items = byDay[key] || []
                return (
                  <div key={key} className="min-h-[72px] rounded border border-gray-100 p-1">
                    <p className="text-[10px] font-bold text-gray-500">{day}</p>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => a.status === 'scheduled' && setPendingSend(a)}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${
                            a.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-800'
                              : a.status === 'cancelled'
                                ? 'bg-zinc-100 text-zinc-500 line-through'
                                : 'bg-violet-50 text-violet-800'
                          }`}
                          title={a.title}
                        >
                          {a.title}
                        </button>
                      ))}
                      {items.length > 3 ? (
                        <p className="text-[10px] text-gray-400">+{items.length - 3} more</p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Schedule announcement</h3>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ALL">All users</option>
            <option value="SELLERS">Sellers</option>
            <option value="BUYERS">Buyers</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={4}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-gray-500">Times are in your local timezone.</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void schedule()}
            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add to calendar'}
          </button>
          <p className="text-[11px] text-gray-500">
            Click a scheduled item to send or cancel the schedule. Nothing auto-sends until you confirm.
          </p>
        </div>
      </div>

      {pendingSend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Scheduled announcement</h3>
            <p className="mt-1 text-sm text-gray-600">
              “{pendingSend.title}” · {pendingSend.segment}
            </p>
            <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Send now delivers the push immediately. Cancel announcement removes it from the calendar.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction(pendingSend.id, 'send_now')}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Send now'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction(pendingSend.id, 'cancel')}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Cancel announcement
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPendingSend(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
