-- AV Survey — Full Schema
-- v3: WLS redesign — group_number replaces condition on responses,
--     transparency replaces s-tias, cognitive-load replaces NASA-TLX,
--     new columns: trust_calibration_item, safety, jian 2-factor,
--                  intentionality (intent1-4), expl_influenced, manip_check_global
-- Run the full file in your Supabase SQL editor to set up or re-apply the schema.

-- ─── Helper trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── responses table (participant-level data) ───────────────────────────────
CREATE TABLE IF NOT EXISTS responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID UNIQUE NOT NULL,
  group_number    INTEGER,                    -- WLS group 0–3 (replaces condition)
  condition       TEXT,                       -- NULL for WLS participants; kept for legacy
  scenario_order  INTEGER[],                  -- randomized display order, e.g. [2,0,4,1,3]
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  completed       BOOLEAN DEFAULT FALSE,

  -- Tech check
  exclude_mobile  BOOLEAN,
  audio_ok        BOOLEAN,

  -- Demographics
  age             TEXT,
  gender          TEXT,
  education       TEXT,
  license         TEXT,
  drive_years     TEXT,
  drive_freq      TEXT,
  av_exp          TEXT,
  av_familiarity  INTEGER,

  -- Baseline trust — Propensity to Trust (1-5)
  pt1 INTEGER, pt2 INTEGER, pt3 INTEGER,
  pt4 INTEGER, pt5 INTEGER, pt6 INTEGER,
  -- AV Attitudes (1-7)
  av1 INTEGER, av2 INTEGER, av3 INTEGER,

  -- Attention check 1 (color block: 'Blue' = correct)
  ac1         TEXT,
  attn_fail_1 BOOLEAN,

  -- Attention check 2 (post-loop)
  ac2          TEXT,
  attn_fail_2  BOOLEAN,

  -- End-of-study
  overall_trust        INTEGER,   -- 1-7, single item after all scenarios
  manip_check_global   TEXT,      -- 'yes' | 'no' | 'not_sure' — did any clips have explanations?
  expl_preference_open TEXT,      -- optional: which explanation format helped most?
  debrief_open         TEXT,      -- "which situation did you understand best and why?"

  -- Exclusion flags
  exclude_final BOOLEAN,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS responses_updated_at ON responses;
CREATE TRIGGER responses_updated_at
  BEFORE UPDATE ON responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Safe migrations for existing responses table ───────────────────────────
ALTER TABLE responses ADD COLUMN IF NOT EXISTS group_number          INTEGER;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS scenario_order        INTEGER[];
ALTER TABLE responses ADD COLUMN IF NOT EXISTS overall_trust         INTEGER;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS manip_check_global    TEXT;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS expl_preference_open  TEXT;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS debrief_open          TEXT;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS exclude_final         BOOLEAN;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS ac2                   TEXT;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS attn_fail_2           BOOLEAN;

-- Migrate ac1 from INTEGER to TEXT for color-block attention check
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'responses' AND column_name = 'ac1' AND data_type = 'integer'
  ) THEN
    ALTER TABLE responses ALTER COLUMN ac1 TYPE TEXT USING ac1::TEXT;
  END IF;
END $$;

-- ─── scenario_responses table (per-scenario data, 5 rows per participant) ───
CREATE TABLE IF NOT EXISTS scenario_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   UUID NOT NULL REFERENCES responses(participant_id) ON DELETE CASCADE,
  scenario_index   INTEGER NOT NULL,   -- display position: 0..4
  scenario_id      TEXT NOT NULL,      -- e.g. 'S1_JaywalkingAdult'
  condition        TEXT NOT NULL,      -- none | template | vlm_descriptive | vlm_teleological
  criticality      TEXT NOT NULL,      -- HIGH | MEDIUM | LOW

  -- Video
  video_watched    BOOLEAN,

  -- Comprehension (3 MCQ, auto-scored)
  comp1            TEXT,
  comp2            TEXT,
  comp3            TEXT,
  comp1_correct    BOOLEAN,
  comp2_correct    BOOLEAN,
  comp3_correct    BOOLEAN,
  comp_score       INTEGER,
  comp_fail        BOOLEAN,

  -- Jian Trust Scale (1-7, 12 items, shuffled)
  jian1  INTEGER, jian2  INTEGER, jian3  INTEGER,
  jian4  INTEGER, jian5  INTEGER, jian6  INTEGER,
  jian7  INTEGER, jian8  INTEGER, jian9  INTEGER,
  jian10 INTEGER, jian11 INTEGER, jian12 INTEGER,
  jian_order          INTEGER[],
  jian_composite      REAL,        -- all 12 items combined (reversed where applicable)
  jian_trust_mean     REAL,        -- items 6–12 (positive factor)
  jian_distrust_mean  REAL,        -- items 1–5 reversed (negative factor)

  -- Gyevnar trust calibration item (1-7, all conditions)
  trust_calibration_item  INTEGER,

  -- Perceived Safety (1-7, all conditions)
  safety1      INTEGER,   -- "I felt safe during this clip."
  safety2      INTEGER,   -- "This situation seemed risky or dangerous." [reverse]
  safety_mean  REAL,

  -- Perceived Transparency (1-7, all conditions — previously mislabeled S-TIAS)
  transp1      INTEGER,
  transp2      INTEGER,
  transp3      INTEGER,
  transp_mean  REAL,

  -- Cognitive Load — single item 1-7 (replaces NASA-TLX)
  cognitive_load  INTEGER,

  -- Mental Model (single-sentence open text)
  mental_model_text  TEXT,

  -- Intentionality Attribution (1-7, all conditions — H3)
  intent1      INTEGER,
  intent2      INTEGER,
  intent3      INTEGER,
  intent4      INTEGER,
  intent_mean  REAL,

  -- Explanation Helpfulness (1-7, NULL for 'none' condition)
  expl_clear      INTEGER,
  expl_helpful    INTEGER,
  expl_influenced INTEGER,
  expl_mean       REAL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (participant_id, scenario_index)
);

ALTER TABLE scenario_responses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS scenario_responses_updated_at ON scenario_responses;
CREATE TRIGGER scenario_responses_updated_at
  BEFORE UPDATE ON scenario_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Safe migrations for existing scenario_responses table ──────────────────

-- Rename S-TIAS columns → transparency
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='scenario_responses' AND column_name='stias1') THEN
    ALTER TABLE scenario_responses RENAME COLUMN stias1     TO transp1;
    ALTER TABLE scenario_responses RENAME COLUMN stias2     TO transp2;
    ALTER TABLE scenario_responses RENAME COLUMN stias3     TO transp3;
    ALTER TABLE scenario_responses RENAME COLUMN stias_mean TO transp_mean;
  END IF;
END $$;

-- Rename expl_informed → expl_influenced
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='scenario_responses' AND column_name='expl_informed') THEN
    ALTER TABLE scenario_responses RENAME COLUMN expl_informed TO expl_influenced;
  END IF;
END $$;

-- Drop NASA-TLX columns
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_mental;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_physical;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_temporal;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_performance;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_effort;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_frustration;
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS tlx_composite;

-- Drop old anthropomorphism column (replaced by intent1-4 subscale)
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS anthropomorphism;

-- Drop second mental model field
ALTER TABLE scenario_responses DROP COLUMN IF EXISTS mental_model_text2;

-- Add new columns (safe to re-run)
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS transp1                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS transp2                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS transp3                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS transp_mean             REAL;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS cognitive_load          INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS trust_calibration_item  INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS safety1                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS safety2                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS safety_mean             REAL;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS jian_trust_mean         REAL;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS jian_distrust_mean      REAL;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS intent1                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS intent2                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS intent3                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS intent4                 INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS intent_mean             REAL;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS expl_influenced         INTEGER;
ALTER TABLE scenario_responses ADD COLUMN IF NOT EXISTS expl_timing_pref        TEXT;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sr_participant  ON scenario_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_sr_condition    ON scenario_responses(condition);
CREATE INDEX IF NOT EXISTS idx_sr_scenario_id  ON scenario_responses(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sr_criticality  ON scenario_responses(criticality);
