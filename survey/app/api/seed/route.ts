import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/seed
 * Inserts 4 complete test participants (one per WLS group) with all fields filled.
 * Safe to re-run — uses upsert. For development only.
 */

const WLS_MATRIX = [
  ['none',             'vlm_descriptive',  'vlm_teleological', 'vlm_descriptive',  'vlm_teleological'], // group 0
  ['vlm_descriptive',  'none',             'vlm_teleological', 'vlm_teleological', 'vlm_descriptive' ], // group 1
  ['vlm_teleological', 'vlm_descriptive',  'none',             'vlm_descriptive',  'vlm_teleological'], // group 2
  ['vlm_descriptive',  'vlm_teleological', 'vlm_descriptive',  'none',             'vlm_teleological'], // group 3
  ['vlm_teleological', 'vlm_teleological', 'vlm_descriptive',  'vlm_descriptive',  'none'            ], // group 4
]

const SCENARIO_IDS = [
  'S1_JaywalkingAdult',
  'S2_SuddenStopEvasion',
  'S4_EmergencyVehiclePullOver',
  'S5v2_HiddenCyclist',
  'L3_NarrowStreetNav',
]
const CRITICALITIES = ['HIGH', 'HIGH', 'MEDIUM', 'HIGH', 'LOW']

// Correct answers per scenario — must match lib/scenarios.ts exactly
const CORRECT_ANSWERS = [
  // S1_JaywalkingAdult
  [
    'A pedestrian stepped into the road mid-block with no crosswalk',
    'It applied emergency braking',
    'No warning: the pedestrian appeared suddenly with no prior signal',
  ],
  // S2_SuddenStopEvasion
  [
    'The vehicle ahead came to a sudden complete stop',
    'It braked, steered left to evade, then resumed speed',
    'A highway at approximately 60 km/h',
  ],
  // S4_EmergencyVehiclePullOver
  [
    'An emergency vehicle approaching from behind with lights and sirens',
    'It pulled over to the right side and yielded the lane',
    'Because there was no visible obstacle or hazard ahead of the vehicle',
  ],
  // S5v2_HiddenCyclist
  [
    'A blind spot behind a parked vehicle or building corner',
    'It applied emergency braking',
    'There was no line of sight to the cyclist before they appeared',
  ],
  // L3_NarrowStreetNav
  [
    'A narrow urban street with parked cars on both sides',
    'It slowed down and carefully drove through at low speed',
    'No emergency event occurred: the vehicle drove normally and predictably',
  ],
]

const MENTAL_MODELS = [
  'It braked to avoid a pedestrian who crossed mid-block unexpectedly.',
  'The leading vehicle stopped suddenly and the AV had to brake to prevent a collision.',
  'It yielded to the emergency vehicle by pulling toward the curb as required by law.',
  'A cyclist appeared suddenly from between parked cars and the AV braked to avoid a collision.',
  'It slowed down to safely navigate between the parked cars on both sides of the narrow street.',
]

// Participant configs: one per WLS group (5 groups)
const SEED_CONFIGS = [
  { group: 0, scenario_order: [2, 0, 4, 1, 3], age: '18-24', gender: 'Man',      education: "Bachelor's degree", drive_freq: 'Daily',   av_exp: 'Never'          },
  { group: 1, scenario_order: [3, 1, 0, 4, 2], age: '25-34', gender: 'Woman',    education: "Master's degree",   drive_freq: 'Weekly',  av_exp: 'Heard about it' },
  { group: 2, scenario_order: [1, 4, 2, 0, 3], age: '35-44', gender: 'Non-binary', education: 'Some college',    drive_freq: 'Monthly', av_exp: 'Tried it once'  },
  { group: 3, scenario_order: [4, 2, 3, 1, 0], age: '45-54', gender: 'Man',      education: "Doctoral degree",   drive_freq: 'Daily',   av_exp: 'Use regularly'  },
  { group: 4, scenario_order: [0, 3, 1, 2, 4], age: '55-64', gender: 'Woman',    education: "Bachelor's degree", drive_freq: 'Weekly',  av_exp: 'Heard about it' },
]

function r(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function GET() {
  const participants: Record<string, any>[] = []
  const scenarioRows: Record<string, any>[] = []

  for (const cfg of SEED_CONFIGS) {
    const pid = crypto.randomUUID()
    const now = Date.now()
    const startTime = new Date(now - (r(35, 50)) * 60000).toISOString()
    const endTime   = new Date(now).toISOString()

    // Propensity to Trust (1-5)
    const pt = Array.from({ length: 6 }, () => r(1, 5))
    // AV Attitudes (1-7)
    const av = Array.from({ length: 3 }, () => r(3, 7))

    participants.push({
      participant_id:      pid,
      group_number:        cfg.group,
      scenario_order:      cfg.scenario_order,
      start_time:          startTime,
      end_time:            endTime,
      completed:           true,
      exclude_mobile:      false,
      audio_ok:            true,
      age:                 cfg.age,
      gender:              cfg.gender,
      education:           cfg.education,
      license:             'Yes',
      drive_years:         ['1-3', '3-10', '10-20', '20+', '10-20'][cfg.group],
      drive_freq:          cfg.drive_freq,
      av_exp:              cfg.av_exp,
      av_familiarity:      r(1, 7),
      pt1: pt[0], pt2: pt[1], pt3: pt[2], pt4: pt[3], pt5: pt[4], pt6: pt[5],
      av1: av[0], av2: av[1], av3: av[2],
      ac1:          'Blue',  // correct: color block answer
      attn_fail_1:  false,
      ac2:          'Extremely',   // correct
      attn_fail_2:  false,
      overall_trust:         r(3, 7),
      manip_check_global:    'yes',
      expl_preference_open:  cfg.group % 2 === 0 ? 'The teleological explanation felt most intuitive.' : null,
      debrief_open:          'The emergency vehicle scenario was the clearest because the vehicle behavior matched expectations.',
      exclude_final:         false,
    })

    for (let slot = 0; slot < 5; slot++) {
      const scenarioIdx = cfg.scenario_order[slot]
      const condition   = WLS_MATRIX[cfg.group][slot] as string
      const correctAns  = CORRECT_ANSWERS[scenarioIdx]

      // Mostly correct answers, occasionally wrong
      const comp1 = r(0, 9) < 8 ? correctAns[0] : 'A cyclist running a red light'
      const comp2 = r(0, 9) < 8 ? correctAns[1] : 'It swerved into the oncoming lane'
      const comp3 = r(0, 9) < 7 ? correctAns[2] : 'It did not react at all'

      const comp1_correct = comp1 === correctAns[0]
      const comp2_correct = comp2 === correctAns[1]
      const comp3_correct = comp3 === correctAns[2]
      const comp_score    = [comp1_correct, comp2_correct, comp3_correct].filter(Boolean).length

      // Jian 12 items (1-7)
      const jianRaw = Array.from({ length: 12 }, () => r(1, 7))
      const jianOrder = Array.from({ length: 12 }, (_, i) => i).sort(() => Math.random() - 0.5)

      const trustScores    = jianRaw.slice(5, 12)
      const distrustScores = jianRaw.slice(0, 5)
      const jian_trust_mean    = parseFloat((trustScores.reduce((a, b) => a + b, 0) / 7).toFixed(3))
      const jian_distrust_mean = parseFloat((distrustScores.reduce((a, b) => a + b, 0) / 5).toFixed(3))
      const reversedDistrust   = distrustScores.map(v => 8 - v)
      const jian_composite     = parseFloat(([...reversedDistrust, ...trustScores].reduce((a, b) => a + b, 0) / 12).toFixed(3))

      const safety1 = r(1, 7)
      const safety2 = r(1, 7)
      const safety_mean = parseFloat(((safety1 + (8 - safety2)) / 2).toFixed(3))

      const [t1, t2, t3] = [r(2, 7), r(2, 7), r(2, 7)]
      const transp_mean = parseFloat(((t1 + t2 + t3) / 3).toFixed(3))

      const [i1, i2, i3, i4] = [r(2, 7), r(2, 7), r(2, 7), r(2, 7)]
      const intent_mean = parseFloat(((i1 + i2 + i3 + i4) / 4).toFixed(3))

      const hasExpl      = condition !== 'none'
      const expl_clear      = hasExpl ? r(2, 7) : null
      const expl_helpful    = hasExpl ? r(2, 7) : null
      const expl_influenced = hasExpl ? r(2, 7) : null
      const expl_mean = hasExpl
        ? parseFloat(((expl_clear! + expl_helpful! + expl_influenced!) / 3).toFixed(3))
        : null

      scenarioRows.push({
        participant_id:         pid,
        scenario_index:         slot,
        scenario_id:            SCENARIO_IDS[scenarioIdx],
        condition,
        criticality:            CRITICALITIES[scenarioIdx],
        video_watched:          true,
        comp1, comp2, comp3,
        comp1_correct, comp2_correct, comp3_correct, comp_score,
        comp_fail:              comp_score < 1,
        jian1:  jianRaw[0],  jian2:  jianRaw[1],  jian3:  jianRaw[2],
        jian4:  jianRaw[3],  jian5:  jianRaw[4],  jian6:  jianRaw[5],
        jian7:  jianRaw[6],  jian8:  jianRaw[7],  jian9:  jianRaw[8],
        jian10: jianRaw[9],  jian11: jianRaw[10], jian12: jianRaw[11],
        jian_order:             jianOrder,
        jian_composite,
        jian_trust_mean,
        jian_distrust_mean,
        trust_calibration_item: r(2, 7),
        safety1, safety2, safety_mean,
        transp1: t1, transp2: t2, transp3: t3, transp_mean,
        cognitive_load:         r(1, 7),
        mental_model_text:      MENTAL_MODELS[scenarioIdx],
        intent1: i1, intent2: i2, intent3: i3, intent4: i4, intent_mean,
        expl_clear, expl_helpful, expl_influenced, expl_mean,
      })
    }
  }

  const { error: e1 } = await supabase
    .from('responses')
    .upsert(participants, { onConflict: 'participant_id' })
  if (e1) return NextResponse.json({ error: 'responses: ' + e1.message }, { status: 500 })

  const { error: e2 } = await supabase
    .from('scenario_responses')
    .upsert(scenarioRows, { onConflict: 'participant_id,scenario_index' })
  if (e2) return NextResponse.json({ error: 'scenario_responses: ' + e2.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    inserted: {
      participants:        participants.length,
      scenario_responses:  scenarioRows.length,
      participant_ids:     participants.map(p => p.participant_id),
      groups:              participants.map(p => p.group_number),
    },
  })
}
