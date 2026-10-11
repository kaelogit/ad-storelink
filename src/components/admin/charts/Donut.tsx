'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCount } from './format'

export type DonutSlice = {
  name: string
  value: number
  color: string
}

type Props = {
  slices: DonutSlice[]
  centerLabel?: string
  centerValue?: string
}

export function Donut({ slices, centerLabel, centerValue }: Props) {
  const total = slices.reduce((sum, s) => sum + Number(s.value || 0), 0)
  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatCount(Number(value)), String(name)]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue ? (
            <p className="text-lg font-black text-gray-900">{centerValue}</p>
          ) : (
            <p className="text-lg font-black text-gray-900">{formatCount(total)}</p>
          )}
          {centerLabel ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {centerLabel}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
