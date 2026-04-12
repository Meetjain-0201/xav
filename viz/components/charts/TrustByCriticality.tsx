'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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

interface TrustEntry { condition: string; criticality: string; mean: number; count: number }
interface Props { data: TrustEntry[] }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">Criticality: {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-600">{CONDITION_LABELS[p.name] ?? p.name}</span>
          <span className="font-mono font-semibold text-slate-900 ml-auto pl-3">
            {isNaN(p.value) ? '-' : p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend() {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-3">
      {CONDITIONS.map((cond) => (
        <div key={cond} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: CONDITION_COLORS[cond] }} />
          {CONDITION_LABELS[cond]}
        </div>
      ))}
    </div>
  )
}

export default function TrustByCriticality({ data }: Props) {
  const criticalities = ['HIGH', 'MEDIUM', 'LOW']
  const chartData = criticalities.map((crit) => {
    const row: Record<string, string | number> = { criticality: crit }
    for (const cond of CONDITIONS) {
      const entry = data.find((d) => d.condition === cond && d.criticality === crit)
      row[cond] = entry && entry.mean != null && !isNaN(entry.mean) ? parseFloat(entry.mean.toFixed(3)) : 0
    }
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }} barCategoryGap="20%" barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="criticality" tick={{ fontSize: 13, fontWeight: 600, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]}
            tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            label={{ value: 'Jian Trust (1–7)', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#94a3b8' } }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.8)' }} />
          {CONDITIONS.map((cond) => (
            <Bar key={cond} dataKey={cond} name={cond} radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((entry) => (
                <Cell key={`${cond}-${entry.criticality}`} fill={CONDITION_COLORS[cond]} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  )
}
