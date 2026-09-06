'use client'

import { AccessFlag, ResultFlag } from '@/lib/dva/types'
import ResultFlagBadge from './ResultFlagBadge'
import AccessFlagBadge from './AccessFlagBadge'

// Deliberately kept as two independent flags, not one merged score: a junction can be
// dimensionally fine but installation-flagged, or vice versa, and each points to a
// different fix — tolerance tightening for one, redesigning access/sequence for the other.
export default function RiskOverview({
  dimensionalFlag,
  buildabilityFlag,
}: {
  dimensionalFlag: ResultFlag | null
  buildabilityFlag: AccessFlag | null
}) {
  if (!dimensionalFlag && !buildabilityFlag) return null

  return (
    <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <p className="text-sm font-semibold text-deck-text">Risk overview</p>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:w-fit sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-deck-dim">Dimensional (fit)</p>
          <div className="mt-1">{dimensionalFlag ? <ResultFlagBadge flag={dimensionalFlag} /> : <span className="text-sm text-deck-dim">Not run</span>}</div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-deck-dim">Buildability (installation)</p>
          <div className="mt-1">{buildabilityFlag ? <AccessFlagBadge flag={buildabilityFlag} /> : <span className="text-sm text-deck-dim">Not run</span>}</div>
        </div>
      </div>
    </div>
  )
}
