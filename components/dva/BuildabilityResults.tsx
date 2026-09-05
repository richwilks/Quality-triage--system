'use client'

import { BuildabilityResult } from '@/lib/dva/types'
import AccessFlagBadge from './AccessFlagBadge'

export default function BuildabilityResults({ result, unit }: { result: BuildabilityResult | null; unit: string }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 text-sm text-deck-dim">
        Run a calculation to see fixing access &amp; sequence results.
      </div>
    )
  }

  if (result.fixings.length === 0) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 text-sm text-deck-dim">
        No fixings defined for this junction — nothing to check for buildability.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-deck-text">Fixing access</p>
          <AccessFlagBadge flag={result.overallFlag} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-deck-border bg-deck-raised text-left text-xs font-semibold uppercase tracking-wide text-deck-dim">
                <th className="px-3 py-2">Fixing</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Nominal</th>
                <th className="px-3 py-2">Worst-case</th>
                <th className="px-3 py-2">Shortfall</th>
                <th className="px-3 py-2">Clearance fail rate</th>
                <th className="px-3 py-2">Sequence</th>
                <th className="px-3 py-2">Flag</th>
              </tr>
            </thead>
            <tbody>
              {result.fixings.map((f) => (
                <tr key={f.fixingId} className="border-b border-deck-border last:border-0">
                  <td className="px-3 py-2 font-medium text-deck-text">{f.fixingName}</td>
                  <td className="px-3 py-2 text-deck-body">
                    {f.staticAccess.requiredClearance.toFixed(0)} {unit}
                  </td>
                  <td className="px-3 py-2 text-deck-body">
                    {f.staticAccess.nominalClearance.toFixed(0)} {unit}
                  </td>
                  <td className="px-3 py-2 text-deck-body">
                    {f.staticAccess.worstCaseClearance.toFixed(0)} {unit}
                  </td>
                  <td className="px-3 py-2 text-deck-body">
                    {f.staticAccess.shortfall > 0 ? `${f.staticAccess.shortfall.toFixed(0)} ${unit} short` : '—'}
                  </td>
                  <td className="px-3 py-2 text-deck-body">
                    {f.toleranceSensitivity ? `${(f.toleranceSensitivity.clearanceFailRate * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-deck-body">{f.sequenceOk ? 'OK' : 'Blocked'}</td>
                  <td className="px-3 py-2">
                    <AccessFlagBadge flag={f.overallFlag} className="text-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <p className="text-sm font-semibold text-deck-text">Installation sequence</p>
        {result.sequence.satisfiable ? (
          <p className="mt-2 text-sm text-deck-body">
            A valid installation order exists:{' '}
            {result.sequence.order
              .map((id) => result.fixings.find((f) => f.fixingId === id)?.fixingName ?? id)
              .join(' → ')}
            .
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {result.sequence.issues.map((issue, i) => (
              <li key={i}>{issue.reason}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
