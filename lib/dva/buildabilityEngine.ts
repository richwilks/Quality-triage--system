// Fixing & installation buildability engine (DVA addendum). A second, independent
// analysis layer over the same junction: not "does it fit dimensionally" but "can a
// person actually install it" — tool access space, tolerance-sensitivity of that
// access, and whether the declared installation sequence is even satisfiable.
// Framework-agnostic and independently unit-tested — see __tests__/buildabilityEngine.test.ts.

import { AT_RISK_MARGIN_FRACTION } from './types'
import type {
  AccessFlag,
  BuildabilityResult,
  Fixing,
  FixingResult,
  FixingStaticAccessResult,
  FixingToleranceSensitivityResult,
  Junction,
  SequenceCheckResult,
  SequenceIssue,
} from './types'

const ACCESS_SEVERITY: Record<AccessFlag, number> = { pass: 0, marginal: 1, fail: 2 }

function worseAccessFlag(a: AccessFlag, b: AccessFlag): AccessFlag {
  return ACCESS_SEVERITY[a] >= ACCESS_SEVERITY[b] ? a : b
}

/**
 * Flags an available clearance against what's required:
 * - "fail": less clearance than required — the tool has nowhere to go
 * - "marginal": enough clearance, but inside a safety margin of the requirement
 * - "pass": comfortably clear
 */
export function flagClearance(available: number, required: number): AccessFlag {
  if (available < required) return 'fail'
  const margin = required * AT_RISK_MARGIN_FRACTION
  if (available < required + margin) return 'marginal'
  return 'pass'
}

export interface DimensionalContext {
  nominal: number
  worstCaseMin: number
  worstCaseMax: number
}

/** 3.1 static access check: does the required access envelope fit at nominal, and under worst-case tolerance? */
export function checkStaticAccess(fixing: Fixing, dimensional: DimensionalContext): FixingStaticAccessResult {
  const clearanceAt = (outcome: number) =>
    fixing.nominalAvailableClearance + fixing.clearanceSensitivity * (outcome - dimensional.nominal)

  const nominalClearance = fixing.nominalAvailableClearance
  // Worst case for this fixing is whichever dimensional extreme shrinks its clearance
  // most — not necessarily the same extreme that's worst for the dimensional gap itself.
  const worstCaseClearance = Math.min(clearanceAt(dimensional.worstCaseMin), clearanceAt(dimensional.worstCaseMax))

  const nominalFlag = flagClearance(nominalClearance, fixing.requiredClearance)
  const worstCaseFlag = flagClearance(worstCaseClearance, fixing.requiredClearance)

  return {
    requiredClearance: fixing.requiredClearance,
    nominalClearance,
    worstCaseClearance,
    nominalFlag,
    worstCaseFlag,
    overallFlag: worseAccessFlag(nominalFlag, worstCaseFlag),
    shortfall: Math.max(0, fixing.requiredClearance - worstCaseClearance),
  }
}

/**
 * 3.2 tolerance-sensitivity of access: replays the dimensional Monte Carlo outcomes
 * (not a fresh sample) through this fixing's clearance model, so the two checks stay
 * consistent with each other run-for-run.
 */
export function checkToleranceSensitivity(
  fixing: Fixing,
  dimensionalNominal: number,
  monteCarloOutcomes: number[]
): FixingToleranceSensitivityResult {
  let clearanceFailCount = 0
  let worstClearance = Infinity

  for (const outcome of monteCarloOutcomes) {
    const clearance = fixing.nominalAvailableClearance + fixing.clearanceSensitivity * (outcome - dimensionalNominal)
    if (clearance < fixing.requiredClearance) clearanceFailCount++
    if (clearance < worstClearance) worstClearance = clearance
  }

  const runs = monteCarloOutcomes.length
  return {
    runs,
    clearanceFailCount,
    clearanceFailRate: runs > 0 ? clearanceFailCount / runs : 0,
    worstClearance: runs > 0 ? worstClearance : fixing.nominalAvailableClearance,
    flag: runs > 0 ? flagClearance(worstClearance, fixing.requiredClearance) : 'pass',
  }
}

/**
 * 3.3 sequence check: is there at least one installation order that satisfies every
 * fixing's "must already be in place" / "must not yet be in place" constraints? This
 * is a topological-sort feasibility check (Kahn's algorithm) over a "before" graph —
 * a cycle means no valid order exists for the fixings caught in it.
 */
export function checkSequence(fixings: Fixing[]): SequenceCheckResult {
  const ids = new Set(fixings.map((f) => f.id))
  const issues: SequenceIssue[] = []

  const beforeEdges = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  for (const f of fixings) {
    beforeEdges.set(f.id, new Set())
    inDegree.set(f.id, 0)
  }

  function addEdge(fromId: string, toId: string) {
    const edges = beforeEdges.get(fromId)!
    if (!edges.has(toId)) {
      edges.add(toId)
      inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1)
    }
  }

  for (const f of fixings) {
    for (const dependsOnId of f.mustFollow) {
      if (!ids.has(dependsOnId)) {
        issues.push({ fixingIds: [f.id], reason: `"${f.name}" depends on unknown fixing id "${dependsOnId}"` })
        continue
      }
      addEdge(dependsOnId, f.id) // dependsOnId must come before f
    }
    for (const mustComeAfterId of f.mustPrecede) {
      if (!ids.has(mustComeAfterId)) {
        issues.push({ fixingIds: [f.id], reason: `"${f.name}" must precede unknown fixing id "${mustComeAfterId}"` })
        continue
      }
      addEdge(f.id, mustComeAfterId) // f must come before mustComeAfterId
    }
  }

  const queue = fixings.filter((f) => inDegree.get(f.id) === 0).map((f) => f.id)
  const order: string[] = []
  const remainingInDegree = new Map(inDegree)

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const nextId of beforeEdges.get(id) ?? []) {
      const degree = (remainingInDegree.get(nextId) ?? 0) - 1
      remainingInDegree.set(nextId, degree)
      if (degree === 0) queue.push(nextId)
    }
  }

  if (order.length < fixings.length) {
    const cycleIds = fixings.map((f) => f.id).filter((id) => !order.includes(id))
    const nameById = new Map(fixings.map((f) => [f.id, f.name]))
    issues.push({
      fixingIds: cycleIds,
      reason: `Circular installation sequence dependency: ${cycleIds.map((id) => nameById.get(id) ?? id).join(' → ')}`,
    })
  }

  return { satisfiable: issues.length === 0, order, issues }
}

export function runBuildabilityCheck(
  junction: Junction,
  dimensional: DimensionalContext,
  options: { monteCarloOutcomes?: number[] } = {}
): BuildabilityResult {
  const fixings = junction.fixings ?? []
  const sequence = checkSequence(fixings)
  const fixingsInIssues = new Set(sequence.issues.flatMap((issue) => issue.fixingIds))

  const results: FixingResult[] = fixings.map((fixing) => {
    const staticAccess = checkStaticAccess(fixing, dimensional)
    const toleranceSensitivity = options.monteCarloOutcomes
      ? checkToleranceSensitivity(fixing, dimensional.nominal, options.monteCarloOutcomes)
      : null
    const sequenceOk = !fixingsInIssues.has(fixing.id)

    let overallFlag = worseAccessFlag(staticAccess.overallFlag, toleranceSensitivity?.flag ?? 'pass')
    if (!sequenceOk) overallFlag = 'fail'

    return {
      fixingId: fixing.id,
      fixingName: fixing.name,
      staticAccess,
      toleranceSensitivity,
      sequenceOk,
      overallFlag,
    }
  })

  const overallFlag = results.reduce<AccessFlag>((worst, r) => worseAccessFlag(worst, r.overallFlag), 'pass')

  return { fixings: results, sequence, overallFlag }
}
