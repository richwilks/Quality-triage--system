'use client'

import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HistogramBucket } from '@/lib/dva/monteCarlo'

export default function DistributionChart({
  buckets,
  acceptableMin,
  acceptableMax,
  unit,
}: {
  buckets: HistogramBucket[]
  acceptableMin: number
  acceptableMax: number
  unit: string
}) {
  const data = buckets.map((b) => ({
    midpoint: (b.min + b.max) / 2,
    label: `${b.min.toFixed(1)}–${b.max.toFixed(1)}`,
    count: b.count,
    inRange: b.min >= acceptableMin && b.max <= acceptableMax,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DCD8CE" vertical={false} />
          <ReferenceArea x1={acceptableMin} x2={acceptableMax} fill="#1E7A46" fillOpacity={0.08} ifOverflow="extendDomain" />
          <XAxis
            dataKey="midpoint"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => v.toFixed(0)}
            stroke="#767162"
            fontSize={12}
            label={{ value: unit, position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#767162' }}
          />
          <YAxis stroke="#767162" fontSize={12} allowDecimals={false} label={{ value: 'runs', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#767162' }} />
          <Tooltip
            formatter={(value: number) => [value, 'runs']}
            labelFormatter={(_, payload) => (payload?.[0]?.payload ? `${payload[0].payload.label} ${unit}` : '')}
          />
          <Bar dataKey="count">
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.inRange ? '#2A6F77' : '#B91C1C'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-deck-dim">
        Shaded band = acceptable range ({acceptableMin}–{acceptableMax} {unit}). Red bars fall outside it.
      </p>
    </div>
  )
}
