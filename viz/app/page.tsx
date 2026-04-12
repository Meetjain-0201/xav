'use client'

import React, { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ChartCard from '@/components/ui/ChartCard'

const TrustByCriticality = dynamic(() => import('@/components/charts/TrustByCriticality'), { ssr: false, loading: () => <SkeletonChart height={380} /> })
const CognitiveLoadBar   = dynamic(() => import('@/components/charts/CognitiveLoadBar'),   { ssr: false, loading: () => <SkeletonChart height={260} /> })
const TrustTrajectory    = dynamic(() => import('@/components/charts/TrustTrajectory'),    { ssr: false, loading: () => <SkeletonChart height={320} /> })
const ComprehensionBar   = dynamic(() => import('@/components/charts/ComprehensionBar'),   { ssr: false, loading: () => <SkeletonChart height={260} /> })
const StiasBar           = dynamic(() => import('@/components/charts/StiasBar'),           { ssr: false, loading: () => <SkeletonChart height={260} /> })
const ExplanationBar     = dynamic(() => import('@/components/charts/ExplanationBar'),     { ssr: false, loading: () => <SkeletonChart height={260} /> })
const AnthroBar          = dynamic(() => import('@/components/charts/AnthroBar'),          { ssr: false, loading: () => <SkeletonChart height={260} /> })
const QualitativeFeed    = dynamic(() => import('@/components/charts/QualitativeFeed'),    { ssr: false, loading: () => <SkeletonChart height={260} /> })

interface Summary           { total: number; completed: number; byCondition: Record<string, number> }
interface TrustByCritEntry  { condition: string; criticality: string; mean: number; count: number }
interface CogLoadEntry      { condition: string; mean: number; count: number }
interface TrajectoryEntry   { scenario_index: number; condition: string; mean: number }
interface CompEntry         { condition: string; accuracy: number; count: number }
interface TransparencyEntry { condition: string; mean: number }
interface ExplEntry         { condition: string; clear: number; helpful: number; influenced: number }
interface IntentEntry       { condition: string; mean: number }
interface OverallTrust      { mean: number; count: number }
interface MentalModel       { scenario_id: string; condition: string; text: string }
interface OpenResponse      { participant_id: string; expl_preference_open: string | null; debrief_open: string | null }
interface Qualitative       { mentalModels: MentalModel[]; openResponses: OpenResponse[] }

interface StatsData {
  summary:                     Summary
  trustByConditionCriticality: TrustByCritEntry[]
  cognitiveLoad:               CogLoadEntry[]
  trustTrajectory:             TrajectoryEntry[]
  comprehension:               CompEntry[]
  transparency:                TransparencyEntry[]
  explanation:                 ExplEntry[]
  intentionality:              IntentEntry[]
  overallTrust:                OverallTrust
  qualitative:                 Qualitative
}

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

function fmt(v: number | undefined | null, decimals = 2): string {
  if (v === undefined || v === null || isNaN(v)) return '-'
  return v.toFixed(decimals)
}

function SkeletonChart({ height }: { height: number }) {
  return <div className="skeleton rounded-xl w-full" style={{ height }} />
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="skeleton rounded w-48 h-4 mb-4" />
      <div className="skeleton rounded-xl w-full h-40" />
    </div>
  )
}

function RadarIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" stroke="#334155" strokeWidth="1" className="pulse-ring" />
      <circle cx="28" cy="28" r="18" stroke="#334155" strokeWidth="1" />
      <circle cx="28" cy="28" r="10" stroke="#334155" strokeWidth="1" />
      <circle cx="28" cy="28" r="3" fill="#06b6d4" />
      <line x1="28" y1="2" x2="28" y2="54" stroke="#1e293b" strokeWidth="0.5" />
      <line x1="2" y1="28" x2="54" y2="28" stroke="#1e293b" strokeWidth="0.5" />
      <g className="radar-sweep" style={{ transformOrigin: '28px 28px' }}>
        <line x1="28" y1="28" x2="54" y2="28" stroke="url(#sweepGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="52" cy="28" r="2.5" fill="#06b6d4" opacity="0.9" />
      </g>
      <defs>
        <linearGradient id="sweepGrad" x1="28" y1="28" x2="54" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function SummaryTable({ data }: { data: StatsData }) {
  const getJian = (cond: string) => {
    const vals = data.trustByConditionCriticality.filter(d => d.condition === cond && !isNaN(d.mean))
    if (!vals.length) return null
    const total = vals.reduce((s, d) => s + d.mean * d.count, 0)
    const n = vals.reduce((s, d) => s + d.count, 0)
    return n > 0 ? total / n : null
  }
  const getCogLoad = (cond: string) => data.cognitiveLoad.find(d => d.condition === cond)?.mean ?? null
  const getComp    = (cond: string) => data.comprehension.find(d => d.condition === cond)?.accuracy ?? null
  const getTransp  = (cond: string) => data.transparency.find(d => d.condition === cond)?.mean ?? null
  const getIntent  = (cond: string) => data.intentionality.find(d => d.condition === cond)?.mean ?? null
  const getN       = (cond: string) => data.summary.byCondition[cond] ?? 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            {['Condition', 'N (obs)', 'Jian', 'Cog Load', 'Comp%', 'Transp.', 'Intent.'].map(h => (
              <th key={h} className={`py-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 ${h === 'Condition' ? 'text-left pr-3' : 'text-right px-2'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONDITIONS.map((cond, i) => {
            const compVal = getComp(cond)
            return (
              <tr key={cond} className={`border-b border-slate-50 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CONDITION_COLORS[cond] }} />
                    <span className="font-medium text-slate-700">{CONDITION_LABELS[cond]}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 font-mono text-slate-600">{getN(cond)}</td>
                <td className="text-right py-2 px-2 font-mono text-slate-800 font-semibold">{fmt(getJian(cond))}</td>
                <td className="text-right py-2 px-2 font-mono text-slate-600">{fmt(getCogLoad(cond), 1)}</td>
                <td className="text-right py-2 px-2 font-mono text-slate-600">
                  {compVal == null || isNaN(compVal) ? '-' : `${compVal.toFixed(1)}%`}
                </td>
                <td className="text-right py-2 px-2 font-mono text-slate-600">{fmt(getTransp(cond))}</td>
                <td className="text-right py-2 pl-2 font-mono text-slate-600">{fmt(getIntent(cond))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function DashboardPage() {
  const [data,        setData]        = useState<StatsData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      setData(await res.json())
      setLastUpdated(new Date())
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-50 shadow-lg" style={{ background: '#0f172a' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center gap-5">
          <div className="flex-shrink-0"><RadarIcon /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight tracking-tight">xav</h1>
            <p className="text-slate-400 text-xs mt-0.5">Explainability in Autonomous Vehicles - Live Results</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs">
            {lastUpdated && <span className="text-slate-400">Updated <span className="text-slate-300 font-mono">{formatTime(lastUpdated)}</span></span>}
            {data && <span className="text-slate-400"><span className="text-cyan-400 font-semibold">{data.summary.total}</span> participants</span>}
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span><strong>Data error:</strong> {error}</span>
          </div>
        )}

        {data && (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span><span className="font-semibold text-slate-800">{data.summary.total}</span> participants enrolled</span>
            <span><span className="font-semibold text-slate-800">{data.summary.completed}</span> completed ({data.summary.total > 0 ? Math.round((data.summary.completed / data.summary.total) * 100) : 0}%)</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map(cond => (
            <span key={cond} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: CONDITION_COLORS[cond] }}>
              {CONDITION_LABELS[cond]}
            </span>
          ))}
        </div>

        {loading && !data ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="skeleton rounded w-64 h-5 mb-4" /><SkeletonChart height={380} />
          </div>
        ) : data ? (
          <ChartCard title="Trust by Condition × Scenario Criticality" subtitle="Jian et al. (2000) trust subscale mean (1–7) grouped by criticality level">
            <TrustByCriticality data={data.trustByConditionCriticality} />
          </ChartCard>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading && !data ? (<><SkeletonCard /><SkeletonCard /></>) : data ? (
            <>
              <ChartCard title="Cognitive Load by Condition" subtitle="Single-item mental demand rating (1–7, lower = less load)">
                <CognitiveLoadBar data={data.cognitiveLoad} />
              </ChartCard>
              <ChartCard title="Trust Trajectory Across Scenarios" subtitle="Mean Jian trust subscale per scenario slot (S1–S5) by condition">
                <TrustTrajectory data={data.trustTrajectory} />
              </ChartCard>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading && !data ? (<><SkeletonCard /><SkeletonCard /></>) : data ? (
            <>
              <ChartCard title="Comprehension Accuracy by Condition" subtitle="Average % of comprehension questions answered correctly (0–100%)">
                <ComprehensionBar data={data.comprehension} />
              </ChartCard>
              <ChartCard title="Perceived Transparency by Condition" subtitle="Mean transparency rating (1–7) - understanding, predictability, clarity">
                <StiasBar data={data.transparency} />
              </ChartCard>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading && !data ? (<><SkeletonCard /><SkeletonCard /></>) : data ? (
            <>
              <ChartCard title="Explanation Helpfulness" subtitle="Clarity, helpfulness, and influence ratings (1–7) - vlm conditions only">
                {data.explanation.length > 0
                  ? <ExplanationBar data={data.explanation} />
                  : <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No explanation data yet</div>}
              </ChartCard>
              <ChartCard title="Intentionality Attribution by Condition" subtitle="Perceived deliberateness of AV actions (1–7)">
                <AnthroBar data={data.intentionality} />
              </ChartCard>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading && !data ? (<><SkeletonCard /><SkeletonCard /></>) : data ? (
            <>
              <ChartCard title="Overall Trust" subtitle={`End-of-study global trust rating (1–7) · N = ${data.overallTrust.count} completed`}>
                <div className="flex items-center justify-center h-40">
                  <div className="text-center">
                    <p className="text-6xl font-bold text-slate-800 font-mono">{fmt(data.overallTrust.mean)}</p>
                    <p className="text-slate-400 text-sm mt-2">mean overall trust / 7</p>
                  </div>
                </div>
              </ChartCard>
              <ChartCard title="Summary - All Means" subtitle="Aggregated measure means by condition">
                <SummaryTable data={data} />
              </ChartCard>
            </>
          ) : null}
        </div>

        {loading && !data ? (
          <SkeletonCard />
        ) : data?.qualitative ? (
          <ChartCard
            title="Participant Responses"
            subtitle="Mental model explanations and open-ended reflections (most recent 50)"
          >
            <QualitativeFeed
              mentalModels={data.qualitative.mentalModels}
              openResponses={data.qualitative.openResponses}
            />
          </ChartCard>
        ) : null}

        <footer className="text-center text-xs text-slate-400 pb-6">
          AdaptTrust Dashboard · Auto-refreshes every 60 seconds ·{' '}
          {lastUpdated ? `Last updated ${formatTime(lastUpdated)}` : 'Loading…'}
        </footer>
      </main>
    </div>
  )
}
