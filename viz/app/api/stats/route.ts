import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const CONDITIONS = ['none', 'vlm_descriptive', 'vlm_teleological']
const CRITICALITIES = ['HIGH', 'MEDIUM', 'LOW']

function mean(vals: number[]): number {
  const valid = vals.filter((v) => v !== null && v !== undefined && !isNaN(v))
  if (valid.length === 0) return NaN
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

type ScenarioRow = {
  participant_id: string
  scenario_index: number
  condition: string
  criticality: string
  jian_composite: number | null
  cognitive_load: number | null
  comp_score: number | null
  transp_mean: number | null
  expl_clear: number | null
  expl_helpful: number | null
  expl_influenced: number | null
  intent_mean: number | null
}

type ResponseRow = {
  participant_id: string
  completed: boolean
  overall_trust: number | null
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const [scenarioResult, responseResult] = await Promise.all([
      supabase
        .from('scenario_responses')
        .select(
          'participant_id,scenario_index,condition,criticality,jian_composite,cognitive_load,comp_score,transp_mean,expl_clear,expl_helpful,expl_influenced,intent_mean'
        ),
      supabase.from('responses').select('participant_id,completed,overall_trust'),
    ])

    if (scenarioResult.error) {
      return NextResponse.json({ error: scenarioResult.error.message }, { status: 500 })
    }
    if (responseResult.error) {
      return NextResponse.json({ error: responseResult.error.message }, { status: 500 })
    }

    const scenarios: ScenarioRow[] = scenarioResult.data ?? []
    const responses: ResponseRow[] = responseResult.data ?? []

    // --- Summary ---
    const total     = responses.length
    const completed = responses.filter((r) => r.completed).length
    // Count scenario_responses per condition (WLS: each participant contributes to all conditions)
    const byCondition: Record<string, number> = {}
    for (const s of scenarios) {
      if (CONDITIONS.includes(s.condition)) {
        byCondition[s.condition] = (byCondition[s.condition] ?? 0) + 1
      }
    }

    // --- Trust by Condition × Criticality ---
    const trustByConditionCriticality = CONDITIONS.flatMap((cond) =>
      CRITICALITIES.map((crit) => {
        const vals = scenarios
          .filter((s) => s.condition === cond && s.criticality === crit && s.jian_composite !== null)
          .map((s) => s.jian_composite as number)
        return { condition: cond, criticality: crit, mean: mean(vals), count: vals.length }
      })
    )

    // --- Cognitive Load (replaces NASA-TLX) ---
    const cognitiveLoad = CONDITIONS.map((cond) => {
      const vals = scenarios
        .filter((s) => s.condition === cond && s.cognitive_load !== null)
        .map((s) => s.cognitive_load as number)
      return { condition: cond, mean: mean(vals), count: vals.length }
    })

    // --- Trust Trajectory ---
    const trustTrajectory = CONDITIONS.flatMap((cond) =>
      [0, 1, 2, 3, 4].map((idx) => {
        const vals = scenarios
          .filter((s) => s.condition === cond && s.scenario_index === idx && s.jian_composite !== null)
          .map((s) => s.jian_composite as number)
        return { scenario_index: idx, condition: cond, mean: mean(vals) }
      })
    )

    // --- Comprehension ---
    const comprehension = CONDITIONS.map((cond) => {
      const rows = scenarios.filter((s) => s.condition === cond && s.comp_score !== null)
      const pcts = rows.map((r) => ((r.comp_score as number) / 3) * 100)
      return { condition: cond, accuracy: mean(pcts), count: rows.length }
    })

    // --- Transparency (was S-TIAS) ---
    const transparency = CONDITIONS.map((cond) => {
      const vals = scenarios
        .filter((s) => s.condition === cond && s.transp_mean !== null)
        .map((s) => s.transp_mean as number)
      return { condition: cond, mean: mean(vals) }
    })

    // --- Explanation Helpfulness (non-none only) ---
    const explanation = CONDITIONS.filter((c) => c !== 'none').map((cond) => {
      const rows = scenarios.filter((s) => s.condition === cond)
      return {
        condition:  cond,
        clear:      mean(rows.map((r) => r.expl_clear).filter((v) => v !== null) as number[]),
        helpful:    mean(rows.map((r) => r.expl_helpful).filter((v) => v !== null) as number[]),
        influenced: mean(rows.map((r) => r.expl_influenced).filter((v) => v !== null) as number[]),
      }
    })

    // --- Intentionality Attribution (replaces Anthropomorphism) ---
    const intentionality = CONDITIONS.map((cond) => {
      const vals = scenarios
        .filter((s) => s.condition === cond && s.intent_mean !== null)
        .map((s) => s.intent_mean as number)
      return { condition: cond, mean: mean(vals) }
    })

    // --- Overall Trust (within-subjects: single global mean) ---
    const completedResponses = responses.filter((r) => r.completed && r.overall_trust !== null)
    const overallTrust = {
      mean:  mean(completedResponses.map((r) => r.overall_trust as number)),
      count: completedResponses.length,
    }

    return NextResponse.json(
      {
        summary: { total, completed, byCondition },
        trustByConditionCriticality,
        cognitiveLoad,
        trustTrajectory,
        comprehension,
        transparency,
        explanation,
        intentionality,
        overallTrust,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
