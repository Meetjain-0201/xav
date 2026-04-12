'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const CONDITION_COLORS: Record<string, string> = {
  vlm_descriptive:  '#8b5cf6',
  vlm_teleological: '#06b6d4',
}

const CONDITION_LABELS: Record<string, string> = {
  vlm_descriptive:  'VLM Descriptive',
  vlm_teleological: 'VLM Teleological',
}

interface ExplEntry { condition: string; clear: number; helpful: number; influenced: number }
interface Props { data: ExplEntry[] }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-600">{CONDITION_LABELS[p.name] ?? p.name}</span>
          <span className="font-mono font-semibold text-slate-900 ml-auto pl-3">
            {isNaN(p.value) ? '—' : p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ExplanationBar({ data }: Props) {
  const conditions = data.map((d) => d.condition)
  const dimensions = [
    { key: 'clear',      label: 'Clear'      },
    { key: 'helpful',    label: 'Helpful'    },
    { key: 'influenced', label: 'Influenced' },
  ]

  const chartData = dimensions.map(({ key, label }) => {
    const row: Record<string, string | number> = { dimension: label }
    for (const d of data) {
      const val = d[key as keyof ExplEntry] as number
      row[d.condition] = val == null ? 0 : parseFloat(val.toFixed(3))
    }
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }} barCategoryGap="25%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]}
            tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            label={{ value: 'Rating (1–7)', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#94a3b8' } }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.8)' }} />
          {conditions.map((cond) => (
            <Bar key={cond} dataKey={cond} name={cond} radius={[4, 4, 0, 0]} maxBarSize={40}
              fill={CONDITION_COLORS[cond]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {conditions.map((cond) => (
          <div key={cond} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: CONDITION_COLORS[cond] }} />
            {CONDITION_LABELS[cond]}
          </div>
        ))}
      </div>
    </div>
  )
}
