'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
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
  vlm_descriptive: 'VLM Desc.',
  vlm_teleological: 'VLM Teleo.',
}

interface TrustEntry {
  condition: string
  mean: number
  count: number
}

interface Props {
  data: TrustEntry[]
}

interface TooltipPayloadItem {
  value: number
  payload: { count: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-600 mt-1">
        Overall Trust:{' '}
        <span className="font-mono font-bold text-slate-900">
          {payload[0].value.toFixed(2)}
        </span>
      </p>
      <p className="text-slate-400">N = {payload[0].payload.count}</p>
    </div>
  )
}

export default function OverallTrustBar({ data }: Props) {
  const chartData = data.map((d) => ({
    condition: CONDITION_LABELS[d.condition] ?? d.condition,
    conditionKey: d.condition,
    mean: d.mean == null ? 0 : parseFloat(d.mean.toFixed(3)),
    count: d.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }} barSize={52}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="condition"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[1, 7]}
          ticks={[1, 2, 3, 4, 5, 6, 7]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          label={{
            value: 'Overall Trust (1–7)',
            angle: -90,
            position: 'insideLeft',
            offset: 5,
            style: { fontSize: 10, fill: '#94a3b8' },
          }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.8)' }} />
        <Bar dataKey="mean" radius={[6, 6, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.conditionKey} fill={CONDITION_COLORS[entry.conditionKey]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
