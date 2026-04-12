export type Condition = 'none' | 'vlm_descriptive' | 'vlm_teleological'
export type Criticality = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Williams Latin Square — 3 conditions × 5 scenario slots, 5 groups.
 * Row = group_number (0–4), Col = scenario display slot (0–4).
 * Each participant sees: 1× none, 2× vlm_descriptive, 2× vlm_teleological.
 * 'none' appears in each slot position exactly once across all 5 groups.
 * 4 participants per group → 20 participants total.
 */
export const WLS_MATRIX: Condition[][] = [
  ['none',             'vlm_descriptive',  'vlm_teleological', 'vlm_descriptive',  'vlm_teleological'], // group 0
  ['vlm_descriptive',  'none',             'vlm_teleological', 'vlm_teleological', 'vlm_descriptive' ], // group 1
  ['vlm_teleological', 'vlm_descriptive',  'none',             'vlm_descriptive',  'vlm_teleological'], // group 2
  ['vlm_descriptive',  'vlm_teleological', 'vlm_descriptive',  'none',             'vlm_teleological'], // group 3
  ['vlm_teleological', 'vlm_teleological', 'vlm_descriptive',  'vlm_descriptive',  'none'            ], // group 4
]

/** Number of WLS groups */
export const WLS_GROUPS = 5

/** Get the condition for a given WLS group at a given display slot */
export function getConditionForScenario(groupNumber: number, scenarioDisplayIndex: number): Condition {
  return WLS_MATRIX[groupNumber][scenarioDisplayIndex]
}

/** Assign a group number sequentially / randomly for a new participant */
export function assignGroup(): number {
  return Math.floor(Math.random() * WLS_GROUPS)
}

export interface ComprehensionQuestion {
  name: 'comp1' | 'comp2' | 'comp3'
  question: string
  options: [string, string, string, string]
  correct: string
}

export interface ScenarioConfig {
  id: string
  label: string
  criticality: Criticality
  /** One YouTube video ID per condition. Use 'PLACEHOLDER' until uploaded. */
  video_ids: Record<Condition, string>
  comprehension: ComprehensionQuestion[]
}

export const SCENARIOS: ScenarioConfig[] = [
  // ── 0 ──────────────────────────────────────────────────────────────────────
  {
    id: 'S1_JaywalkingAdult',
    label: 'Urban Intersection',
    criticality: 'HIGH',
    video_ids: {
      none:             'C3hNE1OdAk0',
      vlm_descriptive:  'HI-ZSjl_bfc',
      vlm_teleological: 'S8EEY3-Z4Uk',
    },
    comprehension: [
      {
        name: 'comp1',
        question: 'Q1. What caused the vehicle to brake suddenly?',
        options: [
          'A cyclist ran a red light ahead',
          'A pedestrian stepped into the road mid-block with no crosswalk',
          'A parked car opened its door into the lane',
          'A traffic signal turned red',
        ],
        correct: 'A pedestrian stepped into the road mid-block with no crosswalk',
      },
      {
        name: 'comp2',
        question: 'Q2. How did the vehicle respond to the hazard?',
        options: [
          'It swerved into the adjacent lane',
          'It honked and slowed gradually',
          'It applied emergency braking',
          'It stopped and waited for the pedestrian to pass',
        ],
        correct: 'It applied emergency braking',
      },
      {
        name: 'comp3',
        question: 'Q3. How much warning did the vehicle have before the pedestrian appeared?',
        options: [
          'Plenty of warning: the pedestrian was visible from a distance',
          'Some warning: the pedestrian paused at the kerb first',
          'No warning: the pedestrian appeared suddenly with no prior signal',
          'The vehicle detected the pedestrian via radar before they were visible',
        ],
        correct: 'No warning: the pedestrian appeared suddenly with no prior signal',
      },
    ],
  },

  // ── 1 ──────────────────────────────────────────────────────────────────────
  {
    id: 'S2_SuddenStopEvasion',
    label: 'Highway Sudden Stop',
    criticality: 'HIGH',
    video_ids: {
      none:             'PLACEHOLDER_S2_NONE',
      vlm_descriptive:  'PLACEHOLDER_S2_DESCRIPTIVE',
      vlm_teleological: 'PLACEHOLDER_S2_TELEOLOGICAL',
    },
    comprehension: [
      {
        name: 'comp1',
        question: 'Q1. What caused the vehicle to react in this clip?',
        options: [
          'A traffic light turned red ahead',
          'A cyclist entered the highway',
          'The vehicle ahead came to a sudden complete stop',
          'The road narrowed unexpectedly',
        ],
        correct: 'The vehicle ahead came to a sudden complete stop',
      },
      {
        name: 'comp2',
        question: 'Q2. Which sequence best describes the vehicle\'s response?',
        options: [
          'It braked, then pulled over to the right',
          'It braked, steered left to evade, then resumed speed',
          'It swerved right immediately without braking',
          'It braked and came to a full stop',
        ],
        correct: 'It braked, steered left to evade, then resumed speed',
      },
      {
        name: 'comp3',
        question: 'Q3. Where did this scenario take place?',
        options: [
          'A narrow urban street at low speed',
          'A residential area with parked cars',
          'A highway at approximately 60 km/h',
          'An intersection in a city centre',
        ],
        correct: 'A highway at approximately 60 km/h',
      },
    ],
  },

  // ── 2 ──────────────────────────────────────────────────────────────────────
  {
    id: 'S4_EmergencyVehiclePullOver',
    label: 'Emergency Vehicle Yield',
    criticality: 'MEDIUM',
    video_ids: {
      none:             'PLACEHOLDER_S4_NONE',
      vlm_descriptive:  'PLACEHOLDER_S4_DESCRIPTIVE',
      vlm_teleological: 'PLACEHOLDER_S4_TELEOLOGICAL',
    },
    comprehension: [
      {
        name: 'comp1',
        question: 'Q1. What triggered the vehicle\'s lane change in this clip?',
        options: [
          'A red traffic light ahead',
          'A pedestrian stepping off the kerb',
          'An emergency vehicle approaching from behind with lights and sirens',
          'Roadworks blocking the current lane',
        ],
        correct: 'An emergency vehicle approaching from behind with lights and sirens',
      },
      {
        name: 'comp2',
        question: 'Q2. What did the autonomous vehicle do?',
        options: [
          'It stopped in the middle of the road',
          'It accelerated to clear the road faster',
          'It moved to the left lane',
          'It pulled over to the right side and yielded the lane',
        ],
        correct: 'It pulled over to the right side and yielded the lane',
      },
      {
        name: 'comp3',
        question: 'Q3. Why might this manoeuvre seem unexpected to a passenger?',
        options: [
          'Because the vehicle exceeded the speed limit',
          'Because there was no visible obstacle or hazard ahead of the vehicle',
          'Because the vehicle ignored a traffic signal',
          'Because the vehicle moved in the wrong direction',
        ],
        correct: 'Because there was no visible obstacle or hazard ahead of the vehicle',
      },
    ],
  },

  // ── 3 ──────────────────────────────────────────────────────────────────────
  {
    id: 'S5v2_HiddenCyclist',
    label: 'Hidden Cyclist',
    criticality: 'HIGH',
    video_ids: {
      none:             'PLACEHOLDER_S5V2_NONE',
      vlm_descriptive:  'PLACEHOLDER_S5V2_DESCRIPTIVE',
      vlm_teleological: 'PLACEHOLDER_S5V2_TELEOLOGICAL',
    },
    comprehension: [
      {
        name: 'comp1',
        question: 'Q1. Where did the cyclist emerge from?',
        options: [
          'A marked bicycle lane on the left',
          'A blind spot behind a parked vehicle or building corner',
          'A side street with a stop sign',
          'The pavement on the right',
        ],
        correct: 'A blind spot behind a parked vehicle or building corner',
      },
      {
        name: 'comp2',
        question: 'Q2. How did the vehicle respond when the cyclist appeared?',
        options: [
          'It swerved into the opposite lane',
          'It continued at speed, relying on the cyclist to move',
          'It applied emergency braking',
          'It slowed gradually and pulled over',
        ],
        correct: 'It applied emergency braking',
      },
      {
        name: 'comp3',
        question: 'Q3. What made this hazard harder to anticipate than a typical one?',
        options: [
          'The road was wet and reduced stopping distance',
          'The cyclist was travelling unusually fast',
          'There was no line of sight to the cyclist before they appeared',
          'The vehicle\'s sensors were blocked by sunlight',
        ],
        correct: 'There was no line of sight to the cyclist before they appeared',
      },
    ],
  },

  // ── 4 ──────────────────────────────────────────────────────────────────────
  {
    id: 'L3_NarrowStreetNav',
    label: 'Narrow Street Navigation',
    criticality: 'LOW',
    video_ids: {
      none:             'PLACEHOLDER_L3_NONE',
      vlm_descriptive:  'PLACEHOLDER_L3_DESCRIPTIVE',
      vlm_teleological: 'PLACEHOLDER_L3_TELEOLOGICAL',
    },
    comprehension: [
      {
        name: 'comp1',
        question: 'Q1. What was the road condition in this clip?',
        options: [
          'A wide multi-lane road with light traffic',
          'A highway on-ramp',
          'A narrow urban street with parked cars on both sides',
          'A road under construction with cones',
        ],
        correct: 'A narrow urban street with parked cars on both sides',
      },
      {
        name: 'comp2',
        question: 'Q2. How did the vehicle navigate the street?',
        options: [
          'It stopped and waited for oncoming traffic to clear',
          'It accelerated quickly to get through the narrow section',
          'It reversed and found a different route',
          'It slowed down and carefully drove through at low speed',
        ],
        correct: 'It slowed down and carefully drove through at low speed',
      },
      {
        name: 'comp3',
        question: 'Q3. How does this clip differ from the other scenarios in the study?',
        options: [
          'The vehicle travelled faster than in the other clips',
          'No emergency event occurred: the vehicle drove normally and predictably',
          'The vehicle had to stop completely for an obstacle',
          'A passenger intervened to take control',
        ],
        correct: 'No emergency event occurred: the vehicle drove normally and predictably',
      },
    ],
  },
]

/** Return the scenario config for a given display index using the stored order */
export function getScenarioForIndex(
  scenarioOrder: number[],
  displayIndex: number
): ScenarioConfig {
  return SCENARIOS[scenarioOrder[displayIndex]]
}

/** Shuffle array indices 0..n-1 */
export function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
