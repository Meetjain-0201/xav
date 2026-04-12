import type { Condition } from './scenarios'

/**
 * Ordered steps within a single scenario loop (5 steps per scenario).
 * - 'transparency' = perceived transparency (3 items) + cognitive load (1 item, merged)
 * - 'reflection'   = mental model text (optional) + intentionality (4 items) + expl helpfulness (3 items, non-none)
 */
const SCENARIO_STEPS = [
  'video',
  'comprehension',
  'trust',
  'transparency',  // includes cognitive-load (merged)
  'reflection',    // includes mental-model (merged)
] as const

export type ScenarioStep = (typeof SCENARIO_STEPS)[number]

export const TOTAL_SCENARIO_STEPS = SCENARIO_STEPS.length   // 5
export const TOTAL_SCENARIOS = 5

/**
 * Returns the next URL path after completing `currentStep` for `scenarioIndex`.
 * After the last scenario's last step, returns '/attention-debrief'.
 */
export function nextScenarioPath(
  scenarioIndex: number,
  currentStep: ScenarioStep,
): string {
  const idx = SCENARIO_STEPS.indexOf(currentStep)
  const nextStep = SCENARIO_STEPS[idx + 1]

  if (nextStep) {
    return `/scenario/${scenarioIndex}/${nextStep}`
  }

  // End of this scenario
  if (scenarioIndex < TOTAL_SCENARIOS - 1) {
    return `/scenario/${scenarioIndex + 1}/video`
  }

  return '/attention-debrief'
}

/** Step number (1-indexed) within a scenario, for progress display */
export function scenarioStepNumber(step: ScenarioStep): number {
  return SCENARIO_STEPS.indexOf(step) + 1
}
