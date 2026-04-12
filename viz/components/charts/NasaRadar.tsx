'use client'

import React from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const CONDITION_COLORS: Record<string, string> = {
  none: '#64748b',
  template: '#3b82f6',
  vlm_descriptive: '#8b5cf6',
  vlm_teleological: '#06b6d4',
}

const CONDITION_LABELS: Record<string, string> = {
  none: 'None',
  template: 'Template',
  vlm_descriptive: 'VLM Descriptive',
  vlm_teleological: 'VLM Teleological',
}

interface TlxRow {
  condition: string
  mental: number
  physical: number
  temporal: number
  performance: number
  effort: number
  frustration: number
}

interface Props {
  data: TlxRow[]
}

const DIMENSIONS = [
  { key: 'mental', label: 'Mental' },
  { key: 'physical', label: 'Physical' },
  { key: 'temporal', label: 'Temporal' },
  { key: 'performance', label: 'Performance' },
  { key: 'effort', label: 'Effort' },
  { key: 'frustration', label: 'Frustration' },
]

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-slate-600">{CONDITION_LABELS[p.name] ?? p.name}</span>
          <span className="font-mono font-semibold text-slate-900 ml-auto pl-3">
            {isNaN(p.value) ? '—' : p.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function NasaRadar({ data }: Props) {
  const chartData = DIMENSIONS.map(({ key, label }) => {
    const row: Record<string, string | number> = { dimension: label }
    for (const d of data) {
      const val = d[key as keyof TlxRow] as number
      row[d.condition] = val == null ? 0 : parseFloat(val.toFixed(2))
    }
    return row
  })

  const conditions = data.map((d) => d.condition)

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickCount={6}
          />
          <Tooltip content={<CustomTooltip />} />
          {conditions.map((cond) => (
            <Radar
              key={cond}
              name={cond}
              dataKey={cond}
              stroke={CONDITION_COLORS[cond]}
              fill={CONDITION_COLORS[cond]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {conditions.map((cond) => (
          <div key={cond} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="inline-block w-4 h-0.5 rounded"
              style={{ background: CONDITION_COLORS[cond] }}
            />
            {CONDITION_LABELS[cond]}
          </div>
        ))}
      </div>
    </div>
  )
}
