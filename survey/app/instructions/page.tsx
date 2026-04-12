'use client'
import { useRouter } from 'next/navigation'
import PageWrapper from '@/components/survey/PageWrapper'

export default function InstructionsPage() {
  const router = useRouter()

  return (
    <PageWrapper title="Video Task Instructions" step={3} totalSteps={10}>
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          You are about to watch <strong>5 short driving clips</strong> showing an autonomous
          vehicle in different situations. You will answer questions after each clip.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-1 border border-gray-200">
          <p className="font-medium mb-2">For each clip you will:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Watch the full video (Continue button appears only when it ends)</li>
            <li>Answer comprehension questions about what you saw</li>
            <li>Rate your experience and share your thoughts</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
            <p className="font-medium">Important:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Keep this browser window active while the video plays</li>
              <li>There are no right or wrong answers for opinion questions</li>
            </ul>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => router.push('/scenario/0/video')}
            className="btn-primary"
          >
            I Understand, Start →
          </button>
        </div>
      </div>
    </PageWrapper>
  )
}
