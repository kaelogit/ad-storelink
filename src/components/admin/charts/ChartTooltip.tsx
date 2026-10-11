'use client'

import { formatCount, formatNaira, formatPct, shortDay } from './format'

type PayloadItem = {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

type Props = {
  active?: boolean
  label?: string
  payload?: PayloadItem[]
  valueKind?: 'money' | 'count' | 'pct' | 'auto'
  moneyKeys?: string[]
  pctKeys?: string[]
}

export function ChartTooltip({
  active,
  label,
  payload,
  valueKind = 'auto',
  moneyKeys = [],
  pctKeys = [],
}: Props) {
  if (!active || !payload?.length) return null

  const formatValue = (item: PayloadItem) => {
    const key = String(item.dataKey ?? item.name ?? '')
    const raw = Number(item.value ?? 0)
    if (valueKind === 'money' || moneyKeys.includes(key)) return formatNaira(raw)
    if (valueKind === 'pct' || pctKeys.includes(key)) return formatPct(raw)
    if (valueKind === 'count') return formatCount(raw)
    if (/gmv|spend|revenue|ecpm|money|amount/i.test(key)) return formatNaira(raw)
    if (/ctr|rate|pct|percent/i.test(key)) return formatPct(raw)
    return formatCount(raw)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {shortDay(String(label ?? ''))}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={String(item.dataKey ?? item.name)} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: item.color || '#64748b' }}
            />
            <span className="text-gray-500">{item.name}</span>
            <span className="ml-auto font-bold text-gray-900">{formatValue(item)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
