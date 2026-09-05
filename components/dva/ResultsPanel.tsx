'use client'

import { Junction, MonteCarloEngineResult, StackUpEngineResult } from '@/lib/dva/types'
import { buildHistogram } from '@/lib/dva/monteCarlo'
import ResultFlagBadge from './ResultFlagBadge'
import DistributionChart from './DistributionChart'
import DominantDriverCallout from './DominantDriverCallout'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-deck-dim">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-deck-text">{value}</p>
    </div>
  )
}

function fmt(n: number, unit: string) {
  return `${n.toFixed(1)} ${unit}`
}

export default function ResultsPanel({
  junction,
  stackUp,
  monteCarlo,
}: {
  junction: Junction
  stackUp: StackUpEngineResult | null
  monteCarlo: MonteCarloEngineResult | null
}) {
  const unit = junction.requirement.unit

  if (!stackUp && !monteCarlo) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 text-sm text-deck-dim">
        Run a calculation to see results.
      </div>
    )
  }

  const overallFlag = monteCarlo?.flag ?? stackUp?.overallFlag ?? 'pass'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-deck-dim">{junction.requirement.parameter} requirement</p>
            <p className="text-sm text-deck-body">
              Acceptable range: {junction.requirement.acceptable_min}–{junction.requirement.acceptable_max} {unit}
            </p>
          </div>
          <ResultFlagBadge flag={overallFlag} />
        </div>

        {stackUp && (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Nominal" value={fmt(stackUp.nominal, unit)} />
            <Stat label="Worst-case range" value={`${fmt(stackUp.worstCase.min, unit)} to ${fmt(stackUp.worstCase.max, unit)}`} />
            <Stat label="RSS range" value={`${fmt(stackUp.rss.min, unit)} to ${fmt(stackUp.rss.max, unit)}`} />
            <div>
              <p className="text-xs uppercase tracking-wide text-deck-dim">Flags</p>
              <div className="mt-1 flex gap-2">
                <ResultFlagBadge flag={stackUp.worstCaseFlag} className="text-xs" />
                <ResultFlagBadge flag={stackUp.rssFlag} className="text-xs" />
              </div>
            </div>
          </div>
        )}

        {monteCarlo && (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Scenarios run" value={monteCarlo.runs.toLocaleString()} />
            <Stat label="Clash / failure rate" value={`${(monteCarlo.failRate * 100).toFixed(1)}%`} />
            <Stat label="Mean outcome" value={fmt(monteCarlo.mean, unit)} />
            <Stat label="Std deviation" value={fmt(monteCarlo.stdDev, unit)} />
          </div>
        )}
      </div>

      {monteCarlo && (
        <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-deck-text">Outcome distribution</p>
          <DistributionChart
            buckets={buildHistogram(monteCarlo.outcomes, 30)}
            acceptableMin={junction.requirement.acceptable_min}
            acceptableMax={junction.requirement.acceptable_max}
            unit={unit}
          />
        </div>
      )}

      {monteCarlo && (
        <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-deck-text">Dominant failure driver</p>
          <DominantDriverCallout drivers={monteCarlo.dominantDrivers} />
        </div>
      )}
    </div>
  )
}
