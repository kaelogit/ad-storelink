'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { ACCENT, formatCount, formatNairaCompact, shortDay, type ChartAccent } from './format'

type Props = {
  data: Array<Record<string, number | string>>
  xKey?: string
  yKey: string
  name?: string
  accent?: ChartAccent
  valueKind?: 'money' | 'count'
  gradientId?: string
}

export function TrendArea({
  data,
  xKey = 'day',
  yKey,
  name,
  accent = 'sky',
  valueKind = 'count',
  gradientId,
}: Props) {
  const a = ACCENT[accent]
  const gid = gradientId || `trend-${accent}-${yKey}`
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={a.fill} stopOpacity={0.28} />
            <stop offset="95%" stopColor={a.fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey={xKey}
          tickFormatter={shortDay}
          stroke="#94a3b8"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => (valueKind === 'money' ? formatNairaCompact(Number(v)) : formatCount(Number(v)))}
        />
        <Tooltip content={<ChartTooltip valueKind={valueKind} />} />
        <Area
          type="monotone"
          dataKey={yKey}
          name={name || yKey}
          stroke={a.stroke}
          strokeWidth={2}
          fill={`url(#${gid})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
