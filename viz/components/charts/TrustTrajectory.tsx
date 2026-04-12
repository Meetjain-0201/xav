'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CONDITION_COLORS: Record<string, string> = {
  none:             '#64748b',
  vlm_descriptive:  '#8b5cf6',
  vlm_teleological: '#06b6d4',
}

const CONDITION_LABELS: Record<string, string> = {
  none:             'None',
  vlm_descriptive:  'VLM Descriptive',
  vlm_teleological: 'VLM Teleological',
}

const CONDITIONS = ['none', 'vlm_descriptive', 'vlm_teleological']

interface TrajectoryEntry { scenario_index: number; condition: string; mean: number }
interface Props { data: TrajectoryEntry[] }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">Scenario {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{CONDITION_LABELS[p.name] ?? p.name}</span>
          <span className="font-mono font-semibold text-slate-900 ml-auto pl-3">
            {isNaN(p.value) ? '—' : p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function TrustTrajectory({ data }: Props) {
  const chartData = [0, 1, 2, 3, 4].map((idx) => {
    const row: Record<string, string | number> = { scenario: `S${idx + 1}` }
    for (const cond of CONDITIONS) {
      const entry = data.find((d) => d.condition === cond && d.scenario_index === idx)
      row[cond] = entry && entry.mean != null && !isNaN(entry.mean) ? parseFloat(entry.mean.toFixed(3)) : 0
    }
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="scenario" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]}
            tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            label={{ value: 'Jian Trust (1–7)', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#94a3b8' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          {CONDITIONS.map((cond) => (
            <Line key={cond} type="monotone" dataKey={cond} name={cond}
              stroke={CONDITION_COLORS[cond]} strokeWidth={2.5}
              dot={{ r: 5, fill: CONDITION_COLORS[cond], strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7 }} connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {CONDITIONS.map((cond) => (
          <div key={cond} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: CONDITION_COLORS[cond] }} />
            {CONDITION_LABELS[cond]}
          </div>
        ))}
      </div>
    </div>
  )
}
