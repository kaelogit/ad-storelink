'use client'

import type { LucideIcon } from 'lucide-react'
import { Sparkline } from './Sparkline'
import { ACCENT, type ChartAccent } from './format'

type Props = {
  icon: LucideIcon
  label: string
  value: string
  sparkData: Array<Record<string, number | string>>
  sparkKey: string
  accent?: ChartAccent
}

export function KpiSparkCard({
  icon: Icon,
  label,
  value,
  sparkData,
  sparkKey,
  accent = 'emerald',
}: Props) {
  const a = ACCENT[accent]
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-400">
          <Icon className={`h-4 w-4 ${a.text}`} />
          <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
      <div className="mt-2">
        <Sparkline data={sparkData} dataKey={sparkKey} accent={accent} />
      </div>
    </div>
  )
}
