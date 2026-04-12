'use client'

import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export default function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span
        className="text-3xl font-bold text-slate-900 tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}
