'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { getSurvey, setScenarioData } from '@/lib/survey-store'
import { nextScenarioPath, scenarioStepNumber, TOTAL_SCENARIO_STEPS, TOTAL_SCENARIOS } from '@/lib/scenario-nav'
import PageWrapper from '@/components/survey/PageWrapper'
import LikertMatrix from '@/components/survey/LikertMatrix'

// Perceived Transparency — custom 3-item scale (all conditions)
const TRANSP_ITEMS = [
  'I understood what the vehicle was doing in this clip.',
  "The vehicle's actions were predictable.",
  'I had a clear sense of why the vehicle acted as it did.',
]

const POINTS = [1, 2, 3, 4, 5, 6, 7]

export default function TransparencyStep({ scenarioIndex }: { scenarioIndex: number }) {
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const survey = getSurvey()

  async function onSubmit(data: any) {
    const transp1 = parseInt(data.transp1, 10)
    const transp2 = parseInt(data.transp2, 10)
    const transp3 = parseInt(data.transp3, 10)
    const transp_mean = parseFloat(((transp1 + transp2 + transp3) / 3).toFixed(3))
    const cognitive_load = parseInt(data.cognitive_load, 10)

    const payload = { transp1, transp2, transp3, transp_mean, cognitive_load }
    setScenarioData(scenarioIndex, payload)
    await fetch('/api/scenario-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: survey.participant_id, scenario_index: scenarioIndex, ...payload }),
    }).catch(console.error)
    router.push(nextScenarioPath(scenarioIndex, 'transparency'))
  }

  return (
    <PageWrapper
      title="Your Experience"
      scenarioInfo={{
        current: scenarioIndex + 1,
        total: TOTAL_SCENARIOS,
        stepNum: scenarioStepNumber('transparency'),
        totalSteps: TOTAL_SCENARIO_STEPS,
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Perceived Transparency */}
        <div>
          <p className="section-title mb-1">How clearly did you understand the vehicle's behavior?</p>
          <p className="section-note mb-4">
            <strong>1 = Not at all &nbsp;·&nbsp; 7 = Extremely</strong>
          </p>
          <LikertMatrix
            items={TRANSP_ITEMS}
            scale={7}
            namePrefix="transp"
            register={register}
            errors={errors}
          />
        </div>

        {/* Cognitive Load — Paas et al. (2003) single item */}
        <div>
          <p className="section-title mb-4">
            How mentally demanding was it to understand this clip?
          </p>
          <p className="section-note mb-4">
            <strong>1 = Very Low &nbsp;·&nbsp; 7 = Very High</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left pb-3 pr-4 w-[45%]" />
                  {POINTS.map((p) => (
                    <th key={p} className="text-center font-semibold text-gray-700 pb-3 px-1 w-10">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-700">Mental demand</td>
                  {POINTS.map((p) => (
                    <td key={p} className="text-center py-3 px-1">
                      <input
                        type="radio"
                        value={String(p)}
                        {...register('cognitive_load')}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>Very Low</span>
            <span>Very High</span>
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary">Continue →</button>
        </div>
      </form>
    </PageWrapper>
  )
}
