// Monte Carlo simulation engine (1D). Samples each component from its own
// tolerance distribution, sums the signed contributions into an outcome, and
// reports failure rate plus which component dominates the failing runs.
// Framework-agnostic and independently unit-tested — see __tests__/monteCarlo.test.ts.

import { mulberry32, sampleStandardNormal, sampleUniform } from './random'
import { DominantDriver, Junction, JunctionComponent, MonteCarloEngineResult, ResultFlag } from './types'
import { flagRange } from './calculationEngine'

export interface MonteCarloOptions {
  /** Number of simulated runs. Defaults to 10,000 per the build brief. */
  samples?: number
  /** How many standard deviations the stated tolerance represents. Defaults to 3 (±tolerance ≈ 3-sigma). */
  sigmaMultiplier?: number
  /** Seed for reproducible runs (tests, "re-run this exact scenario"). Omit for a fresh random run each time. */
  seed?: number
}

interface ComponentSample {
  componentId: string
  delta: number
  /** |delta| as a fraction of the tolerance on that side — used to find the dominant driver. */
  toleranceFraction: number
}

function sampleComponent(
  component: JunctionComponent,
  rng: () => number,
  sigmaMultiplier: number
): ComponentSample {
  let delta: number

  if (component.distribution_type === 'uniform') {
    delta = sampleUniform(rng, -component.tolerance_minus, component.tolerance_plus)
  } else {
    const z = sampleStandardNormal(rng)
    const sigma = (z >= 0 ? component.tolerance_plus : component.tolerance_minus) / sigmaMultiplier
    delta = z * sigma
  }

  const relevantTolerance = delta >= 0 ? component.tolerance_plus : component.tolerance_minus
  const toleranceFraction = relevantTolerance > 0 ? Math.abs(delta) / relevantTolerance : 0

  return { componentId: component.id, delta, toleranceFraction }
}

export function runMonteCarlo(junction: Junction, options: MonteCarloOptions = {}): MonteCarloEngineResult {
  const samples = options.samples ?? 10000
  const sigmaMultiplier = options.sigmaMultiplier ?? 3
  const rng = options.seed !== undefined ? mulberry32(options.seed) : Math.random

  const { acceptable_min, acceptable_max } = junction.requirement
  const outcomes: number[] = []
  const largestContributorIds: string[] = []
  let failCount = 0

  for (let i = 0; i < samples; i++) {
    let outcome = 0
    let largestFraction = -1
    let largestId = junction.components[0]?.id ?? ''

    for (const component of junction.components) {
      const s = sampleComponent(component, rng, sigmaMultiplier)
      outcome += component.sign * (component.nominal_value + s.delta)
      if (s.toleranceFraction > largestFraction) {
        largestFraction = s.toleranceFraction
        largestId = component.id
      }
    }

    outcomes.push(outcome)
    const pass = outcome >= acceptable_min && outcome <= acceptable_max
    if (!pass) {
      failCount++
      largestContributorIds.push(largestId)
    }
  }

  const mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length
  const variance = outcomes.reduce((a, b) => a + (b - mean) ** 2, 0) / outcomes.length
  const stdDev = Math.sqrt(variance)
  // Avoid Math.min(...outcomes) / Math.max(...outcomes): spreading a large sample
  // count as call arguments can exceed the engine's call-stack limit.
  let min = outcomes[0]
  let max = outcomes[0]
  for (const value of outcomes) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const failRate = failCount / samples

  const dominantDrivers = computeDominantDrivers(junction.components, largestContributorIds)
  const flag: ResultFlag = flagRange(min, max, acceptable_min, acceptable_max)

  return { runs: samples, outcomes, failCount, failRate, mean, stdDev, min, max, dominantDrivers, flag }
}

export function computeDominantDrivers(components: JunctionComponent[], failingIds: string[]): DominantDriver[] {
  if (failingIds.length === 0) return []

  const counts = new Map<string, number>()
  for (const id of failingIds) counts.set(id, (counts.get(id) ?? 0) + 1)

  const nameById = new Map(components.map((c) => [c.id, c.name]))

  return Array.from(counts.entries())
    .map(([componentId, count]) => ({
      componentId,
      componentName: nameById.get(componentId) ?? componentId,
      failingRunShare: count / failingIds.length,
    }))
    .sort((a, b) => b.failingRunShare - a.failingRunShare)
}

export interface HistogramBucket {
  min: number
  max: number
  count: number
}

/** Buckets outcomes into evenly-sized bins for a distribution chart. */
export function buildHistogram(outcomes: number[], bucketCount = 30): HistogramBucket[] {
  if (outcomes.length === 0) return []

  let min = outcomes[0]
  let max = outcomes[0]
  for (const value of outcomes) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = max - min

  if (span === 0) {
    return [{ min, max, count: outcomes.length }]
  }

  const width = span / bucketCount
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + i * width,
    max: min + (i + 1) * width,
    count: 0,
  }))

  for (const value of outcomes) {
    const index = Math.min(bucketCount - 1, Math.floor((value - min) / width))
    buckets[index].count++
  }

  return buckets
}
