'use client'

import { useCallback, useEffect, useState } from 'react'

export type QueueKey = 'kyc_identity' | 'kyc_business' | 'content_report'

type Assignment = {
  target_id: string
  assigned_to: string
  assignee_label?: string
  assigned_at?: string
}

export function useQueueAssignments(queueKey: QueueKey, targetIds: string[]) {
  const [map, setMap] = useState<Record<string, Assignment>>({})
  const [me, setMe] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (targetIds.length === 0) {
      setMap({})
      return
    }
    const params = new URLSearchParams({
      queueKey,
      targetIds: targetIds.slice(0, 200).join(','),
    })
    const res = await fetch(`/api/admin/queue-assign?${params.toString()}`)
    if (!res.ok) return
    const data = await res.json()
    setMe(data.me || null)
    const next: Record<string, Assignment> = {}
    for (const row of data.assignments || []) {
      next[row.target_id] = row
    }
    setMap(next)
  }, [queueKey, targetIds.join(',')])

  useEffect(() => {
    void load()
  }, [load])

  const claim = async (targetId: string) => {
    setBusyId(targetId)
    await fetch('/api/admin/queue-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueKey, targetId, action: 'claim' }),
    })
    setBusyId(null)
    await load()
  }

  const release = async (targetId: string) => {
    setBusyId(targetId)
    await fetch('/api/admin/queue-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueKey, targetId, action: 'release' }),
    })
    setBusyId(null)
    await load()
  }

  return { map, me, busyId, claim, release, reload: load }
}

export function AssigneeChip({
  assignment,
  me,
  busy,
  onClaim,
  onRelease,
}: {
  assignment?: Assignment
  me: string | null
  busy?: boolean
  onClaim: () => void
  onRelease: () => void
}) {
  if (assignment) {
    const mine = me && assignment.assigned_to === me
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          if (mine) onRelease()
        }}
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          mine ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-600'
        }`}
        title={mine ? 'Click to release' : 'Assigned'}
      >
        {mine ? 'You' : assignment.assignee_label || 'Assigned'}
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onClaim()
      }}
      className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-50"
    >
      Claim
    </button>
  )
}
