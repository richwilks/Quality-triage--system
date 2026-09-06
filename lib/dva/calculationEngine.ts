// Core 1D stack-up calculation engine: worst-case and RSS (root-sum-square) methods.
// Framework-agnostic and independently unit-tested — see __tests__/calculationEngine.test.ts.

import { AT_RISK_MARGIN_FRACTION, Junction, JunctionComponent, ResultFlag, StackUpEngineResult } from './types'

export function nominalOutcome(components: JunctionComponent[]): number {
  return components.reduce((sum, c) => sum + c.sign * c.nominal_value, 0)
}

/**
 * Worst-case totals assume every component sits at whichever extreme of its own
 * tolerance pushes the outcome furthest in that direction — not necessarily the
 * "+tolerance" side, since a component with sign -1 pushes the outcome down when
 * its own dimension is at its own +tolerance extreme.
 */
export function worstCaseTotals(components: JunctionComponent[]): { plus: number; minus: number } {
  let plus = 0
  let minus = 0
  for (const c of components) {
    if (c.sign === 1) {
      plus += c.tolerance_plus
      minus += c.tolerance_minus
    } else {
      plus += c.tolerance_minus
      minus += c.tolerance_plus
    }
  }
  return { plus, minus }
}

/**
 * RSS totals combine each side's contributing tolerances in quadrature, per side,
 * so an asymmetric component still contributes its correct (signed) tolerance to
 * the correct side of the result.
 */
export function rssTotals(components: JunctionComponent[]): { plus: number; minus: number } {
  let plusSq = 0
  let minusSq = 0
  for (const c of components) {
    const plusSide = c.sign === 1 ? c.tolerance_plus : c.tolerance_minus
    const minusSide = c.sign === 1 ? c.tolerance_minus : c.tolerance_plus
    plusSq += plusSide * plusSide
    minusSq += minusSide * minusSide
  }
  return { plus: Math.sqrt(plusSq), minus: Math.sqrt(minusSq) }
}

/**
 * Flags a [min, max] outcome range against an acceptable range:
 * - "pass": the entire range sits inside acceptable bounds — every realizable outcome is fine
 * - "fail": the range doesn't overlap acceptable bounds at all — no realizable outcome is fine
 * - "at-risk": partial overlap, or the range creeps into a margin just inside the bounds
 */
export function flagRange(min: number, max: number, acceptableMin: number, acceptableMax: number): ResultFlag {
  if (max < acceptableMin || min > acceptableMax) return 'fail'

  const margin = (acceptableMax - acceptableMin) * AT_RISK_MARGIN_FRACTION
  const safeMin = acceptableMin + margin
  const safeMax = acceptableMax - margin

  if (min >= safeMin && max <= safeMax) return 'pass'
  return 'at-risk'
}

const FLAG_SEVERITY: Record<ResultFlag, number> = { pass: 0, 'at-risk': 1, fail: 2 }

function worseFlag(a: ResultFlag, b: ResultFlag): ResultFlag {
  return FLAG_SEVERITY[a] >= FLAG_SEVERITY[b] ? a : b
}

export function runStackUp(junction: Junction): StackUpEngineResult {
  const nominal = nominalOutcome(junction.components)
  const { acceptable_min, acceptable_max } = junction.requirement

  const wc = worstCaseTotals(junction.components)
  const worstCase = {
    min: nominal - wc.minus,
    max: nominal + wc.plus,
    totalTolerance: wc.plus + wc.minus,
  }

  const rss = rssTotals(junction.components)
  const rssRange = {
    min: nominal - rss.minus,
    max: nominal + rss.plus,
    totalTolerance: rss.plus + rss.minus,
  }

  const worstCaseFlag = flagRange(worstCase.min, worstCase.max, acceptable_min, acceptable_max)
  const rssFlag = flagRange(rssRange.min, rssRange.max, acceptable_min, acceptable_max)

  return {
    nominal,
    worstCase,
    rss: rssRange,
    worstCaseFlag,
    rssFlag,
    overallFlag: worseFlag(worstCaseFlag, rssFlag),
  }
}
