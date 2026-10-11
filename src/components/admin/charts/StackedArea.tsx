'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatNairaCompact, shortDay } from './format'

type Series = { key: string; name: string; color: string }

type Props = {
  data: Array<Record<string, number | string>>
  xKey?: string
  series: Series[]
  valueKind?: 'money' | 'count'
}

export function StackedArea({ data, xKey = 'day', series, valueKind = 'money' }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`stack-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
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
          width={52}
          tickFormatter={(v) =>
            valueKind === 'money' ? formatNairaCompact(Number(v)) : String(v)
          }
        />
        <Tooltip content={<ChartTooltip valueKind={valueKind} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId="1"
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#stack-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
