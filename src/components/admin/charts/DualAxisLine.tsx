'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatCount, formatNairaCompact, shortDay } from './format'

type AxisSeries = {
  key: string
  name: string
  color: string
  yAxisId: 'left' | 'right'
  valueKind?: 'money' | 'count' | 'pct'
}

type Props = {
  data: Array<Record<string, number | string>>
  xKey?: string
  left: AxisSeries
  right: AxisSeries
}

export function DualAxisLine({ data, xKey = 'day', left, right }: Props) {
  const moneyKeys = [left, right].filter((s) => s.valueKind === 'money').map((s) => s.key)
  const pctKeys = [left, right].filter((s) => s.valueKind === 'pct').map((s) => s.key)

  const tick = (kind: AxisSeries['valueKind'], v: number) => {
    if (kind === 'money') return formatNairaCompact(v)
    if (kind === 'pct') return `${v}%`
    return formatCount(v)
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          yAxisId="left"
          stroke={left.color}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => tick(left.valueKind || 'count', Number(v))}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={right.color}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => tick(right.valueKind || 'count', Number(v))}
        />
        <Tooltip content={<ChartTooltip moneyKeys={moneyKeys} pctKeys={pctKeys} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Line
          yAxisId={left.yAxisId}
          type="monotone"
          dataKey={left.key}
          name={left.name}
          stroke={left.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId={right.yAxisId}
          type="monotone"
          dataKey={right.key}
          name={right.name}
          stroke={right.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
