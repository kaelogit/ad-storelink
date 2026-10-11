'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { ACCENT, type ChartAccent } from './format'

type Props = {
  data: Array<Record<string, number | string>>
  dataKey: string
  accent?: ChartAccent
  height?: number
}

export function Sparkline({ data, dataKey, accent = 'emerald', height = 36 }: Props) {
  if (!data.length) {
    return <div style={{ height }} className="w-full rounded bg-gray-50" />
  }
  const a = ACCENT[accent]
  const gradId = `spark-${accent}-${dataKey}`
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={a.fill} stopOpacity={0.35} />
              <stop offset="95%" stopColor={a.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={a.stroke}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
