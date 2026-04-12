'use client'
import React from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  fullWidth?: boolean
}

export default function ChartCard({ title, subtitle, children, className = '', fullWidth = false }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${fullWidth ? 'col-span-2' : ''} ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  )
}
