'use client'

import PageHeader from '@/components/PageHeader'
import DvaTool from '@/components/dva/DvaTool'

export default function DvaPage() {
  return (
    <div className="min-h-screen px-4 py-8 print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Dimensional Variation Analysis" />
        <p className="mt-1 text-sm text-deck-dim">
          Stack up realistic manufacturing and installation tolerances for a junction before issue-for-construction,
          to catch clashes and gap failures that nominal-geometry clash detection misses.
        </p>

        <div className="mt-6">
          <DvaTool />
        </div>
      </div>
    </div>
  )
}
