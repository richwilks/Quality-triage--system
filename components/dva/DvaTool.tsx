'use client'

import { useMemo, useState } from 'react'
import { Junction, JunctionRequirement, MonteCarloEngineResult, StackUpEngineResult } from '@/lib/dva/types'
import { runStackUp } from '@/lib/dva/calculationEngine'
import { runMonteCarlo } from '@/lib/dva/monteCarlo'
import { createPrecastPanelToSteelFramePreset } from '@/lib/dva/presets'
import { EvidenceRecord, createEvidenceRecord } from '@/lib/dva/evidenceLog'
import ComponentTable from './ComponentTable'
import ResultsPanel from './ResultsPanel'
import EvidenceLogPanel from './EvidenceLogPanel'
import EvidencePrintView from './EvidencePrintView'

type Mode = 'stack-up' | 'monte-carlo'

export default function DvaTool() {
  const [junction, setJunction] = useState<Junction>(() => createPrecastPanelToSteelFramePreset())
  const [mode, setMode] = useState<Mode>('stack-up')
  const [sampleCount, setSampleCount] = useState(10000)

  const [stackUpResult, setStackUpResult] = useState<StackUpEngineResult | null>(null)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloEngineResult | null>(null)

  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([])
  const [printRecord, setPrintRecord] = useState<EvidenceRecord | null>(null)

  const requirement = junction.requirement

  function updateRequirement(patch: Partial<JunctionRequirement>) {
    setJunction((j) => ({ ...j, requirement: { ...j.requirement, ...patch } }))
  }

  function runCalculation() {
    const stackUp = runStackUp(junction)
    setStackUpResult(stackUp)

    if (mode === 'monte-carlo') {
      setMonteCarloResult(runMonteCarlo(junction, { samples: sampleCount }))
    } else {
      setMonteCarloResult(null)
    }
  }

  function logEvidence() {
    if (!stackUpResult) return
    const record = createEvidenceRecord({
      method: mode === 'monte-carlo' ? 'monte-carlo' : 'worst-case-rss',
      junction,
      overallFlag: monteCarloResult?.flag ?? stackUpResult.overallFlag,
      stackUp: stackUpResult,
      monteCarlo: monteCarloResult ?? undefined,
    })
    setEvidenceRecords((records) => [record, ...records])
  }

  const hasResults = useMemo(() => stackUpResult !== null, [stackUpResult])

  if (printRecord) {
    return <EvidencePrintView record={printRecord} onClose={() => setPrintRecord(null)} />
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-deck-text">Junction</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-deck-body">
            Name
            <input
              type="text"
              value={junction.name}
              onChange={(e) => setJunction((j) => ({ ...j, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
          <label className="text-sm text-deck-body">
            Type
            <input
              type="text"
              value={junction.type}
              onChange={(e) => setJunction((j) => ({ ...j, type: e.target.value }))}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-deck-text">Requirement</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="text-sm text-deck-body sm:col-span-2">
            Parameter
            <input
              type="text"
              value={requirement.parameter}
              onChange={(e) => updateRequirement({ parameter: e.target.value })}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
          <label className="text-sm text-deck-body">
            Acceptable min
            <input
              type="number"
              value={requirement.acceptable_min}
              onChange={(e) => updateRequirement({ acceptable_min: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
          <label className="text-sm text-deck-body">
            Acceptable max
            <input
              type="number"
              value={requirement.acceptable_max}
              onChange={(e) => updateRequirement({ acceptable_max: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
          <label className="text-sm text-deck-body">
            Unit
            <input
              type="text"
              value={requirement.unit}
              onChange={(e) => updateRequirement({ unit: e.target.value })}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-deck-text">Contributing components</h2>
        <p className="mt-1 text-xs text-deck-dim">
          Sign controls the direction each component pushes the {requirement.parameter || 'result'}: + increases it, −
          decreases it.
        </p>
        <div className="mt-3">
          <ComponentTable components={junction.components} onChange={(components) => setJunction((j) => ({ ...j, components }))} />
        </div>
      </div>

      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-deck-text">Run</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-deck-dim">Method</p>
            <div className="mt-1 flex rounded-md border border-deck-border p-0.5">
              <button
                type="button"
                onClick={() => setMode('stack-up')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${mode === 'stack-up' ? 'bg-deck-accent text-white' : 'text-deck-body'}`}
              >
                Worst-case / RSS
              </button>
              <button
                type="button"
                onClick={() => setMode('monte-carlo')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${mode === 'monte-carlo' ? 'bg-deck-accent text-white' : 'text-deck-body'}`}
              >
                Monte Carlo
              </button>
            </div>
          </div>

          {mode === 'monte-carlo' && (
            <label className="text-sm text-deck-body">
              Samples
              <input
                type="number"
                min={100}
                step={1000}
                value={sampleCount}
                onChange={(e) => setSampleCount(Math.max(100, parseInt(e.target.value, 10) || 10000))}
                className="mt-1 block w-32 rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
              />
            </label>
          )}

          <button
            type="button"
            onClick={runCalculation}
            className="rounded-md bg-deck-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Run calculation
          </button>

          {hasResults && (
            <button
              type="button"
              onClick={logEvidence}
              className="rounded-md border border-deck-border px-4 py-2 text-sm font-semibold text-deck-body hover:bg-deck-raised"
            >
              Log as evidence
            </button>
          )}
        </div>
      </div>

      <ResultsPanel junction={junction} stackUp={stackUpResult} monteCarlo={monteCarloResult} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-deck-text">Evidence log</h2>
        <EvidenceLogPanel records={evidenceRecords} onView={setPrintRecord} />
      </div>
    </div>
  )
}
