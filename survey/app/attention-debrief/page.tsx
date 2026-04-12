'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { getSurvey, setSurvey } from '@/lib/survey-store'
import PageWrapper from '@/components/survey/PageWrapper'

const AC2_OPTIONS = ['Blue', 'Green', 'Orange', 'Purple']
const AC2_CORRECT = 'Orange'

const MANIP_OPTIONS = [
  { value: 'yes',      label: 'Yes, some clips included a verbal explanation' },
  { value: 'no',       label: 'No, none of the clips included an explanation' },
  { value: 'not_sure', label: "I'm not sure" },
]

export default function AttentionDebriefPage() {
  const router = useRouter()
  const { register, handleSubmit, watch } = useForm()
  const manipValue = watch('manip_check_global')

  async function onSubmit(data: any) {
    const ac2 = data.ac2 ?? ''
    const attn_fail_2 = ac2 !== AC2_CORRECT
    const payload = {
      ac2,
      attn_fail_2,
      manip_check_global:   data.manip_check_global ?? '',
      expl_preference_open: data.expl_preference_open ?? '',
      debrief_open:         data.debrief_open ?? '',
    }
    setSurvey(payload)
    await fetch('/api/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: getSurvey().participant_id, ...payload }),
    }).catch(console.error)
    router.push('/overall-trust')
  }

  return (
    <PageWrapper title="Final Questions" step={9} totalSteps={10}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* AC2 — Color block */}
        <div>
          <div className="w-14 h-14 rounded-lg bg-orange-500 mb-4" />
          <p className="section-title mb-3">What color is the box above?</p>
          <div className="space-y-2">
            {AC2_OPTIONS.map((opt) => (
              <label key={opt} className="radio-row">
                <input type="radio" value={opt} {...register('ac2')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Manipulation Check */}
        <div>
          <p className="section-title mb-3">
            Did any of the video clips include a verbal explanation of the vehicle's actions?
          </p>
          <div className="space-y-2">
            {MANIP_OPTIONS.map(({ value, label }) => (
              <label key={value} className="radio-row">
                <input type="radio" value={value} {...register('manip_check_global')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Explanation Preference — only shown if participant noticed explanations */}
        {manipValue === 'yes' && (
          <div>
            <label className="section-title block mb-1">
              Which format of explanation, if any, did you find most helpful?
            </label>
            <p className="text-xs text-gray-400 mb-2">Optional.</p>
            <textarea
              {...register('expl_preference_open')}
              rows={3}
              placeholder="Optional: describe what you found helpful or not helpful..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
        )}

        {/* Global Reflection */}
        <div>
          <label className="section-title block mb-1">
            Looking across all 5 clips, which situation did you understand best, and what helped you understand it?
          </label>
          <p className="text-xs text-gray-400 mb-2">Optional.</p>
          <textarea
            {...register('debrief_open')}
            rows={4}
            placeholder="Optional response..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary">Continue →</button>
        </div>
      </form>
    </PageWrapper>
  )
}
