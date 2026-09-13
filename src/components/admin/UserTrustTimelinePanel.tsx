'use client'

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'

type TimelineItem = {
  id: string
  at: string
  kind: string
  title: string
  detail?: string | null
  source: 'audit' | 'kyc' | 'business' | 'status'
}

type Props = {
  userId: string
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function UserTrustTimelinePanel({ userId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<TimelineItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [auditRes, kycRes, bizRes, profileRes] = await Promise.all([
        supabase
          .from('admin_audit_logs')
          .select('id, action_type, details, created_at')
          .eq('target_id', userId)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('merchant_verifications')
          .select('id, status, created_at, updated_at, rejection_reason')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('business_verifications')
          .select('id, status, created_at, updated_at, company_name, rejection_reason')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('profiles').select('account_status, created_at').eq('id', userId).maybeSingle(),
      ])

      if (cancelled) return

      const next: TimelineItem[] = []

      if (profileRes.data?.created_at) {
        next.push({
          id: `joined-${userId}`,
          at: profileRes.data.created_at,
          kind: 'account',
          title: 'Account created',
          detail: profileRes.data.account_status
            ? `Status: ${profileRes.data.account_status}`
            : null,
          source: 'status',
        })
      }

      for (const row of auditRes.data ?? []) {
        const details = (row.details ?? {}) as Record<string, unknown>
        next.push({
          id: `audit-${row.id}`,
          at: row.created_at,
          kind: row.action_type,
          title: String(row.action_type || 'Admin action').replace(/_/g, ' '),
          detail:
            typeof details.message === 'string'
              ? details.message
              : typeof details.reason === 'string'
                ? details.reason
                : null,
          source: 'audit',
        })
      }

      for (const row of kycRes.data ?? []) {
        next.push({
          id: `kyc-${row.id}`,
          at: row.updated_at || row.created_at,
          kind: 'KYC',
          title: `Identity verification ${row.status}`,
          detail: row.rejection_reason || `Submitted ${formatAge(row.created_at)}`,
          source: 'kyc',
        })
      }

      for (const row of bizRes.data ?? []) {
        next.push({
          id: `biz-${row.id}`,
          at: row.updated_at || row.created_at,
          kind: 'Business',
          title: `Business verification ${row.status}`,
          detail: row.rejection_reason || row.company_name || null,
          source: 'business',
        })
      }

      next.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      setItems(next.slice(0, 50))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, supabase])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-gray-500" />
        <h4 className="text-sm font-bold text-gray-900">Trust timeline</h4>
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500">No trust events yet for this user.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-gray-200 pl-4">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold capitalize text-gray-900">{item.title}</p>
              <p className="text-[11px] text-gray-500">
                {formatAge(item.at)} · {item.kind}
              </p>
              {item.detail ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-600">{item.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
