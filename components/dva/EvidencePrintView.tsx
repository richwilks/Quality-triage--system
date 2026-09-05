'use client'

import { EvidenceRecord } from '@/lib/dva/evidenceLog'

export default function EvidencePrintView({ record, onClose }: { record: EvidenceRecord; onClose: () => void }) {
  const { junction } = record

  return (
    <div className="min-h-screen bg-deck-bg px-4 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body hover:bg-deck-raised"
          >
            ← Back to tool
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-deck-accent px-4 py-2 text-sm font-medium text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-deck-border bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <p className="text-xs uppercase tracking-wide text-deck-dim">Dimensional Variation Analysis — Evidence Record</p>
          <h1 className="mt-1 text-2xl font-semibold text-deck-text">{junction.name}</h1>
          <p className="mt-1 text-sm text-deck-body">Junction type: {junction.type}</p>
          <p className="mt-1 text-sm text-deck-body">
            Method: {record.method === 'monte-carlo' ? 'Monte Carlo simulation' : 'Worst-case & RSS stack-up'}
          </p>
          <p className="mt-1 text-sm text-deck-body">Logged: {new Date(record.createdAt).toLocaleString('en-GB')}</p>
          <p className="mt-1 text-sm text-deck-body">Dimensional result: {record.overallFlag.toUpperCase()}</p>
          {record.buildability && record.buildability.fixings.length > 0 && (
            <p className="mt-1 text-sm text-deck-body">Buildability result: {record.buildability.overallFlag.toUpperCase()}</p>
          )}

          <h2 className="mt-6 text-sm font-semibold text-deck-text">Requirement</h2>
          <p className="mt-1 text-sm text-deck-body">
            {junction.requirement.parameter}: {junction.requirement.acceptable_min}–{junction.requirement.acceptable_max}{' '}
            {junction.requirement.unit}
          </p>

          <h2 className="mt-6 text-sm font-semibold text-deck-text">Input components</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-deck-border text-left text-xs uppercase tracking-wide text-deck-dim">
                <th className="py-1.5 pr-3">Component</th>
                <th className="py-1.5 pr-3">Nominal</th>
                <th className="py-1.5 pr-3">Tolerance</th>
                <th className="py-1.5 pr-3">Sign</th>
                <th className="py-1.5">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {junction.components.map((c) => (
                <tr key={c.id} className="border-b border-deck-border last:border-0">
                  <td className="py-1.5 pr-3">{c.name}</td>
                  <td className="py-1.5 pr-3">
                    {c.nominal_value} {junction.requirement.unit}
                  </td>
                  <td className="py-1.5 pr-3">
                    +{c.tolerance_plus} / −{c.tolerance_minus} {junction.requirement.unit}
                  </td>
                  <td className="py-1.5 pr-3">{c.sign === 1 ? '+' : '−'}</td>
                  <td className="py-1.5 capitalize">{c.distribution_type}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {record.stackUp && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-deck-text">Stack-up result</h2>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  <tr className="border-b border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-dim">Nominal</td>
                    <td className="py-1.5">
                      {record.stackUp.nominal.toFixed(1)} {junction.requirement.unit}
                    </td>
                  </tr>
                  <tr className="border-b border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-dim">Worst-case range</td>
                    <td className="py-1.5">
                      {record.stackUp.worstCase.min.toFixed(1)} to {record.stackUp.worstCase.max.toFixed(1)}{' '}
                      {junction.requirement.unit} — {record.stackUp.worstCaseFlag.toUpperCase()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 text-deck-dim">RSS range</td>
                    <td className="py-1.5">
                      {record.stackUp.rss.min.toFixed(1)} to {record.stackUp.rss.max.toFixed(1)} {junction.requirement.unit} —{' '}
                      {record.stackUp.rssFlag.toUpperCase()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {record.monteCarloSummary && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-deck-text">Monte Carlo result</h2>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  <tr className="border-b border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-dim">Scenarios run</td>
                    <td className="py-1.5">{record.monteCarloSummary.runs.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-dim">Failure rate</td>
                    <td className="py-1.5">{(record.monteCarloSummary.failRate * 100).toFixed(1)}%</td>
                  </tr>
                  <tr className="border-b border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-dim">Mean / std dev</td>
                    <td className="py-1.5">
                      {record.monteCarloSummary.mean.toFixed(1)} / {record.monteCarloSummary.stdDev.toFixed(1)}{' '}
                      {junction.requirement.unit}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 align-top text-deck-dim">Dominant driver</td>
                    <td className="py-1.5">
                      {record.monteCarloSummary.dominantDrivers.length > 0
                        ? record.monteCarloSummary.dominantDrivers
                            .slice(0, 3)
                            .map((d) => `${d.componentName} (${Math.round(d.failingRunShare * 100)}%)`)
                            .join(', ')
                        : 'No failing runs'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {record.buildability && record.buildability.fixings.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-deck-text">Fixing access</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-deck-border text-left text-xs uppercase tracking-wide text-deck-dim">
                    <th className="py-1.5 pr-3">Fixing</th>
                    <th className="py-1.5 pr-3">Required</th>
                    <th className="py-1.5 pr-3">Nominal</th>
                    <th className="py-1.5 pr-3">Worst-case</th>
                    <th className="py-1.5 pr-3">Clearance fail rate</th>
                    <th className="py-1.5">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {record.buildability.fixings.map((f) => (
                    <tr key={f.fixingId} className="border-b border-deck-border last:border-0">
                      <td className="py-1.5 pr-3">{f.fixingName}</td>
                      <td className="py-1.5 pr-3">
                        {f.staticAccess.requiredClearance.toFixed(0)} {junction.requirement.unit}
                      </td>
                      <td className="py-1.5 pr-3">
                        {f.staticAccess.nominalClearance.toFixed(0)} {junction.requirement.unit}
                      </td>
                      <td className="py-1.5 pr-3">
                        {f.staticAccess.worstCaseClearance.toFixed(0)} {junction.requirement.unit}
                      </td>
                      <td className="py-1.5 pr-3">
                        {f.toleranceSensitivity ? `${(f.toleranceSensitivity.clearanceFailRate * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-1.5">
                        {f.overallFlag.toUpperCase()}
                        {!f.sequenceOk ? ' (sequence blocked)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className="mt-6 text-sm font-semibold text-deck-text">Installation sequence</h2>
              {record.buildability.sequence.satisfiable ? (
                <p className="mt-1 text-sm text-deck-body">
                  Valid order:{' '}
                  {record.buildability.sequence.order
                    .map((id) => record.buildability!.fixings.find((f) => f.fixingId === id)?.fixingName ?? id)
                    .join(' → ')}
                  .
                </p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-sm text-deck-body">
                  {record.buildability.sequence.issues.map((issue, i) => (
                    <li key={i}>{issue.reason}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="mt-8 text-xs text-deck-dim">
            This record reflects manually entered tolerance data at the time of the run above. It is a design-stage
            risk check, not a substitute for as-built survey, manufacturing QA, or a qualified engineer&rsquo;s sign-off.
          </p>
        </div>
      </div>
    </div>
  )
}
