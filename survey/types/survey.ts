import type { Condition, Criticality } from '@/lib/scenarios'

export type { Condition, Criticality }

// ─── Per-scenario data (one entry per scenario in the loop) ─────────────────
export interface ScenarioResponseData {
  scenario_index: number
  scenario_id: string
  condition: Condition
  criticality: Criticality

  video_watched?: boolean

  // Comprehension (3 MCQ, auto-scored)
  comp1?: string; comp2?: string; comp3?: string
  comp1_correct?: boolean; comp2_correct?: boolean; comp3_correct?: boolean
  comp_score?: number
  comp_fail?: boolean

  // Jian Trust Scale — 12 items (1-7), 2-factor scoring
  jian1?: number;  jian2?: number;  jian3?: number
  jian4?: number;  jian5?: number;  jian6?: number
  jian7?: number;  jian8?: number;  jian9?: number
  jian10?: number; jian11?: number; jian12?: number
  jian_order?: number[]
  jian_composite?: number       // all 12 combined
  jian_trust_mean?: number      // items 6–12 (positive factor)
  jian_distrust_mean?: number | null  // items 1–5 reversed (negative factor)

  // Gyevnar trust calibration item (1-7, all conditions)
  trust_calibration_item?: number

  // Perceived Safety (1-7, all conditions) — H1 calibration
  safety1?: number
  safety2?: number
  safety_mean?: number

  // Perceived Transparency (1-7, all conditions) — H1 mechanism
  // Previously mislabeled "S-TIAS"; these are custom items
  transp1?: number; transp2?: number; transp3?: number
  transp_mean?: number

  // Cognitive Load — single item 1-7 (replaces NASA-TLX) — H4
  cognitive_load?: number

  // Mental Model — single sentence open text — H3
  mental_model_text?: string

  // Intentionality Attribution — 4-item subscale (1-7, all conditions) — H3
  intent1?: number; intent2?: number; intent3?: number; intent4?: number
  intent_mean?: number

  // Explanation Helpfulness (1-7, NULL for 'none' condition) — H2, H3
  expl_clear?: number
  expl_helpful?: number
  expl_influenced?: number
  expl_mean?: number

  // Timing preference — only for vlm_teleological condition
  expl_timing_pref?: string   // 'before' | 'after' | 'both'
}

// ─── Participant-level data (one row in responses table) ────────────────────
export interface SurveyData {
  participant_id: string
  start_time: string
  group_number: number            // WLS group 0–3 (replaces condition)
  scenario_order: number[]        // randomized display indices, e.g. [2,0,4,1,3]

  audio_ok?: boolean
  exclude_mobile?: boolean

  // Demographics
  age?: string
  gender?: string
  education?: string
  license?: string
  drive_years?: string
  drive_freq?: string
  av_exp?: string
  av_familiarity?: number

  // Baseline trust — Propensity to Trust (1-5)
  pt1?: number; pt2?: number; pt3?: number
  pt4?: number; pt5?: number; pt6?: number
  // AV Attitudes (1-7)
  av1?: number; av2?: number; av3?: number

  // Attention check 1 (color block — 'Blue' = correct)
  ac1?: string
  attn_fail_1?: boolean

  // Attention check 2 (post-loop)
  ac2?: string
  attn_fail_2?: boolean

  // End-of-study
  overall_trust?: number
  manip_check_global?: string     // 'yes' | 'no' | 'not_sure'
  expl_preference_open?: string
  debrief_open?: string

  // Exclusion flags
  exclude_final?: boolean

  // Per-scenario data (stored in localStorage, posted to scenario_responses)
  scenarios?: Partial<ScenarioResponseData>[]
}
