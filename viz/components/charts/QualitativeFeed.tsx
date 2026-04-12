'use client'

import React, { useState } from 'react'

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

const SCENARIO_LABELS: Record<string, string> = {
  S1_JaywalkingAdult:           'S1 - Urban Intersection',
  S2_SuddenStopEvasion:         'S2 - Highway Stop',
  S4_EmergencyVehiclePullOver:  'S4 - Emergency Vehicle',
  S5v2_HiddenCyclist:           'S5 - Hidden Cyclist',
  L3_NarrowStreetNav:           'L3 - Narrow Street',
}

interface MentalModel {
  scenario_id: string
  condition:   string
  text:        string
}

interface OpenResponse {
  participant_id:       string
  expl_preference_open: string | null
  debrief_open:         string | null
}

interface Props {
  mentalModels:  MentalModel[]
  openResponses: OpenResponse[]
}

const CONDITIONS = ['none', 'vlm_descriptive', 'vlm_teleological']

export default function QualitativeFeed({ mentalModels, openResponses }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? mentalModels
    : mentalModels.filter((m) => m.condition === filter)

  return (
    <div className="space-y-5">
      {/* Mental Models */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mental Model Responses</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${filter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              All
            </button>
            {CONDITIONS.map((cond) => (
              <button
                key={cond}
                onClick={() => setFilter(cond)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors`}
                style={filter === cond
                  ? { background: CONDITION_COLORS[cond], color: '#fff' }
                  : { background: '#f1f5f9', color: '#64748b' }}
              >
                {CONDITION_LABELS[cond]}
              </button>
            ))}
          </div>
        </div>

        {mentalModels.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-slate-400 text-sm">No responses yet</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filtered.map((m, i) => (
              <div key={i} className="flex gap-3 items-start bg-slate-50 rounded-xl px-3 py-2.5">
                <span
                  className="mt-0.5 flex-shrink-0 inline-block w-2 h-2 rounded-full"
                  style={{ background: CONDITION_COLORS[m.condition] ?? '#94a3b8' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 mb-0.5">
                    {SCENARIO_LABELS[m.scenario_id] ?? m.scenario_id} &middot; {CONDITION_LABELS[m.condition] ?? m.condition}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open-ended responses */}
      {openResponses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Open Responses</p>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {openResponses.map((r, i) => (
              <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5">
                {r.expl_preference_open && (
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Explanation preference</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{r.expl_preference_open}</p>
                  </div>
                )}
                {r.debrief_open && (
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Reflection</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{r.debrief_open}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
