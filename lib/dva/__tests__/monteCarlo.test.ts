import { describe, expect, it } from 'vitest'
import { buildHistogram, computeDominantDrivers, runMonteCarlo } from '../monteCarlo'
import { Junction, JunctionComponent } from '../types'

function component(overrides: Partial<JunctionComponent>): JunctionComponent {
  return {
    id: 'c',
    name: 'component',
    nominal_value: 0,
    tolerance_plus: 0,
    tolerance_minus: 0,
    distribution_type: 'normal',
    contributes_to: 'gap',
    sign: 1,
    ...overrides,
  }
}

// Abramowitz & Stegun 7.1.26 approximation, accurate to ~1.5e-7 — good enough to
// check Monte Carlo convergence against an analytical normal CDF in tests.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const ax = Math.abs(x)
  const t = 1 / (1 + p * ax)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

function normalCdf(x: number, mean: number, stdDev: number): number {
  return 0.5 * (1 + erf((x - mean) / (stdDev * Math.SQRT2)))
}

describe('runMonteCarlo — statistical convergence at high N', () => {
  it('converges mean and stdDev to the analytical values for a single normal component', () => {
    const junction: Junction = {
      id: 'j',
      name: 'single component',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [component({ id: 'a', nominal_value: 15, tolerance_plus: 9, tolerance_minus: 9, sign: 1 })],
    }

    // sigmaMultiplier 3 -> sigma = 9 / 3 = 3
    const result = runMonteCarlo(junction, { samples: 50000, sigmaMultiplier: 3, seed: 42 })

    expect(result.mean).toBeCloseTo(15, 0)
    expect(Math.abs(result.mean - 15)).toBeLessThan(0.1)
    expect(Math.abs(result.stdDev - 3)).toBeLessThan(0.1)
  })

  it('converges failure rate to the analytical normal-distribution probability', () => {
    const junction: Junction = {
      id: 'j',
      name: 'single component',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [component({ id: 'a', nominal_value: 15, tolerance_plus: 9, tolerance_minus: 9, sign: 1 })],
    }

    const result = runMonteCarlo(junction, { samples: 50000, sigmaMultiplier: 3, seed: 7 })

    const sigma = 3
    const expectedPass = normalCdf(20, 15, sigma) - normalCdf(10, 15, sigma)
    const expectedFailRate = 1 - expectedPass

    expect(Math.abs(result.failRate - expectedFailRate)).toBeLessThan(0.02)
  })

  it('is reproducible for a given seed', () => {
    const junction: Junction = {
      id: 'j',
      name: 'single component',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [component({ id: 'a', nominal_value: 15, tolerance_plus: 9, tolerance_minus: 9, sign: 1 })],
    }

    const a = runMonteCarlo(junction, { samples: 1000, seed: 99 })
    const b = runMonteCarlo(junction, { samples: 1000, seed: 99 })
    expect(a.outcomes).toEqual(b.outcomes)
    expect(a.failRate).toBe(b.failRate)
  })

  it('samples uniformly across the full tolerance band for a uniform distribution component', () => {
    const junction: Junction = {
      id: 'j',
      name: 'uniform component',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: -100, acceptable_max: 100, unit: 'mm' },
      components: [
        component({ id: 'a', nominal_value: 0, tolerance_plus: 10, tolerance_minus: 10, distribution_type: 'uniform', sign: 1 }),
      ],
    }

    const result = runMonteCarlo(junction, { samples: 20000, seed: 3 })
    expect(result.min).toBeGreaterThanOrEqual(-10)
    expect(result.max).toBeLessThanOrEqual(10)
    // Uniform on [-10, 10]: mean 0, stdDev = range / sqrt(12) = 20/sqrt(12) ≈ 5.7735
    expect(Math.abs(result.mean)).toBeLessThan(0.3)
    expect(Math.abs(result.stdDev - 20 / Math.sqrt(12))).toBeLessThan(0.2)
  })
})

describe('computeDominantDrivers', () => {
  it('returns an empty list when nothing failed', () => {
    expect(computeDominantDrivers([component({ id: 'a' })], [])).toEqual([])
  })

  it('ranks components by share of failing runs they dominated', () => {
    const components = [component({ id: 'a', name: 'Panel width' }), component({ id: 'b', name: 'Frame bay width' })]
    // 'a' dominates 3 of 4 failing runs, 'b' dominates 1.
    const drivers = computeDominantDrivers(components, ['a', 'a', 'b', 'a'])

    expect(drivers).toHaveLength(2)
    expect(drivers[0]).toEqual({ componentId: 'a', componentName: 'Panel width', failingRunShare: 0.75 })
    expect(drivers[1]).toEqual({ componentId: 'b', componentName: 'Frame bay width', failingRunShare: 0.25 })
  })
})

describe('buildHistogram', () => {
  it('buckets every outcome and preserves the total count', () => {
    const outcomes = Array.from({ length: 1000 }, (_, i) => i / 10) // 0.0 .. 99.9
    const buckets = buildHistogram(outcomes, 10)

    expect(buckets).toHaveLength(10)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1000)
  })

  it('handles a zero-variance dataset without dividing by zero', () => {
    const buckets = buildHistogram([5, 5, 5], 10)
    expect(buckets).toEqual([{ min: 5, max: 5, count: 3 }])
  })

  it('returns an empty array for no data', () => {
    expect(buildHistogram([])).toEqual([])
  })
})
