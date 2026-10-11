'use client'

import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACCENT, type ChartAccent } from './format'

type Props = {
  title: string
  subtitle?: string
  rangeLabel?: string
  accent?: ChartAccent
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  actions?: ReactNode
  className?: string
  height?: number
  children: ReactNode
}

export function ChartCard({
  title,
  subtitle,
  rangeLabel,
  accent = 'slate',
  loading,
  empty,
  emptyMessage = 'No data for this range.',
  actions,
  className = '',
  height = 280,
  children,
}: Props) {
  const a = ACCENT[accent]
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}
      style={{
        backgroundImage: `linear-gradient(180deg, ${a.soft}33 0%, #ffffff 42%)`,
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rangeLabel ? (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${a.chip}`}>
              {rangeLabel}
            </span>
          ) : null}
          {actions}
        </div>
      </div>
      <div style={{ height }} className="relative w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className={`h-6 w-6 animate-spin ${a.text}`} />
          </div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
