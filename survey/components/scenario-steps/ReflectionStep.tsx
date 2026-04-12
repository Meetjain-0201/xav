'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { getSurvey, setScenarioData } from '@/lib/survey-store'
import { nextScenarioPath, scenarioStepNumber, TOTAL_SCENARIO_STEPS, TOTAL_SCENARIOS } from '@/lib/scenario-nav'
import PageWrapper from '@/components/survey/PageWrapper'
import LikertMatrix from '@/components/survey/LikertMatrix'

// Intentionality Attribution — 4-item subscale (H3)
const INTENT_ITEMS = [
  'The vehicle seemed to have a clear goal in mind.',
  'The vehicle appeared to understand what was happening.',
  "The vehicle's actions reflected deliberate decision-making.",
  'The vehicle seemed to be acting with intention.',
]

// Explanation Helpfulness — 3 items, shown only for condition != none (H2, H3)
const EXPL_ITEMS = [
  'The explanation was clear.',
  "The explanation helped me understand the vehicle's action.",
  "The explanation influenced how I felt about the vehicle's behavior.",
]

export default function ReflectionStep({ scenarioIndex, condition }: { scenarioIndex: number; condition: string }) {
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const survey = getSurvey()
  const showExplanation = condition !== 'none'

  async function onSubmit(data: any) {
    const mental_model_text = data.mental_model_text ?? ''

    const intent1 = parseInt(data.intent1, 10)
    const intent2 = parseInt(data.intent2, 10)
    const intent3 = parseInt(data.intent3, 10)
    const intent4 = parseInt(data.intent4, 10)
    const intent_mean = parseFloat(((intent1 + intent2 + intent3 + intent4) / 4).toFixed(3))

    const payload: Record<string, any> = { mental_model_text, intent1, intent2, intent3, intent4, intent_mean }

    if (showExplanation) {
      const expl_clear      = parseInt(data.expl1, 10)
      const expl_helpful    = parseInt(data.expl2, 10)
      const expl_influenced = parseInt(data.expl3, 10)
      const expl_mean = parseFloat(((expl_clear + expl_helpful + expl_influenced) / 3).toFixed(3))
      Object.assign(payload, { expl_clear, expl_helpful, expl_influenced, expl_mean })
    }

    if (condition === 'vlm_teleological') {
      payload.expl_timing_pref = data.expl_timing_pref ?? null
    }

    setScenarioData(scenarioIndex, payload)
    await fetch('/api/scenario-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: survey.participant_id, scenario_index: scenarioIndex, ...payload }),
    }).catch(console.error)
    router.push(nextScenarioPath(scenarioIndex, 'reflection'))
  }

  return (
    <PageWrapper
      title="Reflection"
      scenarioInfo={{
        current: scenarioIndex + 1,
        total: TOTAL_SCENARIOS,
        stepNum: scenarioStepNumber('reflection'),
        totalSteps: TOTAL_SCENARIO_STEPS,
      }}
    >
      <p className="text-gray-500 text-sm mb-6">
        There are no right or wrong answers. We want your genuine understanding.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Mental Model — single-line, optional */}
        <div>
          <label className="section-title block mb-2">
            In one sentence, why did the vehicle act this way?{' '}
            <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            {...register('mental_model_text')}
            placeholder="e.g. It braked because it detected a pedestrian stepping into the road."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Keep it to one sentence.</p>
        </div>

        {/* Intentionality Attribution — all conditions */}
        <div>
          <p className="section-title mb-1">About the vehicle's behavior</p>
          <p className="section-note mb-4">
            <strong>1 = Not at all &nbsp;·&nbsp; 7 = Extremely</strong>
          </p>
          <LikertMatrix
            items={INTENT_ITEMS}
            scale={7}
            namePrefix="intent"
            register={register}
            errors={errors}
          />
        </div>

        {/* Explanation Helpfulness — non-none conditions only */}
        {showExplanation && (
          <div>
            <p className="section-title mb-1">About the explanation you received</p>
            <p className="section-note mb-4">
              <strong>1 = Not at all &nbsp;·&nbsp; 7 = Extremely</strong>
            </p>
            <LikertMatrix
              items={EXPL_ITEMS}
              scale={7}
              namePrefix="expl"
              register={register}
              errors={errors}
            />
          </div>
        )}

        {/* Explanation Timing Preference — teleological condition only */}
        {condition === 'vlm_teleological' && (
          <div>
            <p className="section-title mb-1">
              The explanation described the vehicle's goal — what it was trying to achieve.
            </p>
            <p className="text-sm text-gray-600 mb-3">
              When would you have preferred to receive this type of explanation?
            </p>
            <div className="space-y-2">
              {[
                { value: 'before', label: 'Before the vehicle acted, so I could anticipate what it would do' },
                { value: 'after',  label: 'After the vehicle acted, as it did in this clip' },
                { value: 'both',   label: 'Both would be equally helpful' },
              ].map(({ value, label }) => (
                <label key={value} className="radio-row">
                  <input
                    type="radio"
                    value={value}
                    {...register('expl_timing_pref')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button type="submit" className="btn-primary">
            {scenarioIndex < TOTAL_SCENARIOS - 1 ? 'Next Scenario →' : 'Finish Scenarios →'}
          </button>
        </div>
      </form>
    </PageWrapper>
  )
}
