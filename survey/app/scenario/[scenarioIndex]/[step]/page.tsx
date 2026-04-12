'use client'
import { getSurvey } from '@/lib/survey-store'
import { getConditionForScenario } from '@/lib/scenarios'
import VideoStep from '@/components/scenario-steps/VideoStep'
import ComprehensionStep from '@/components/scenario-steps/ComprehensionStep'
import TransparencyStep from '@/components/scenario-steps/TransparencyStep'
import JianTrustStep from '@/components/scenario-steps/JianTrustStep'
import ReflectionStep from '@/components/scenario-steps/ReflectionStep'

export default function ScenarioStepPage({
  params,
}: {
  params: { scenarioIndex: string; step: string }
}) {
  const { scenarioIndex: indexStr, step } = params
  const idx = parseInt(indexStr, 10)

  if (isNaN(idx) || idx < 0 || idx > 4) {
    return <div className="p-8 text-red-600">Invalid scenario index: {indexStr}</div>
  }

  // Derive condition for this display slot from WLS matrix
  const survey = getSurvey()
  const groupNumber = survey.group_number ?? 0
  const condition = getConditionForScenario(groupNumber, idx)

  switch (step) {
    case 'video':         return <VideoStep scenarioIndex={idx} />
    case 'comprehension': return <ComprehensionStep scenarioIndex={idx} />
    case 'trust':         return <JianTrustStep scenarioIndex={idx} condition={condition} />
    case 'transparency':  return <TransparencyStep scenarioIndex={idx} />
    case 'reflection':    return <ReflectionStep scenarioIndex={idx} condition={condition} />
    default:
      return <div className="p-8 text-red-600">Unknown step: {step}</div>
  }
}
