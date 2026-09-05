// Evidence log records: the Golden Thread / Regulation 38 audit trail hook.
// Captures what was checked, how, and what the result was, at a point in time.

import { Junction, MonteCarloEngineResult, ResultFlag, StackUpEngineResult } from './types'

export type EvidenceMethod = 'worst-case-rss' | 'monte-carlo'

export interface EvidenceRecord {
  id: string
  createdAt: string
  method: EvidenceMethod
  junction: Junction
  overallFlag: ResultFlag
  stackUp?: StackUpEngineResult
  monteCarloSummary?: {
    runs: number
    failRate: number
    mean: number
    stdDev: number
    min: number
    max: number
    dominantDrivers: MonteCarloEngineResult['dominantDrivers']
  }
}

export function createEvidenceRecord(params: {
  method: EvidenceMethod
  junction: Junction
  overallFlag: ResultFlag
  stackUp?: StackUpEngineResult
  monteCarlo?: MonteCarloEngineResult
}): EvidenceRecord {
  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    method: params.method,
    junction: params.junction,
    overallFlag: params.overallFlag,
    stackUp: params.stackUp,
    monteCarloSummary: params.monteCarlo
      ? {
          runs: params.monteCarlo.runs,
          failRate: params.monteCarlo.failRate,
          mean: params.monteCarlo.mean,
          stdDev: params.monteCarlo.stdDev,
          min: params.monteCarlo.min,
          max: params.monteCarlo.max,
          dominantDrivers: params.monteCarlo.dominantDrivers,
        }
      : undefined,
  }
}

export function evidenceRecordToJson(record: EvidenceRecord): string {
  return JSON.stringify(record, null, 2)
}

export function downloadEvidenceJson(record: EvidenceRecord): void {
  const blob = new Blob([evidenceRecordToJson(record)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dva-evidence-${record.junction.id}-${record.createdAt.slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
