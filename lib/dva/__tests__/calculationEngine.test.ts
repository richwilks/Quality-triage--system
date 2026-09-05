import { describe, expect, it } from 'vitest'
import { flagRange, nominalOutcome, rssTotals, runStackUp, worstCaseTotals } from '../calculationEngine'
import { Junction, JunctionComponent } from '../types'
import { createPrecastPanelToSteelFramePreset } from '../presets'

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

describe('nominalOutcome', () => {
  it('sums signed nominal values', () => {
    const components = [
      component({ id: 'a', nominal_value: 100, sign: 1 }),
      component({ id: 'b', nominal_value: 40, sign: -1 }),
    ]
    expect(nominalOutcome(components)).toBe(60)
  })
})

describe('worstCaseTotals — hand-calculated, all symmetric tolerances', () => {
  it('sums every tolerance directly regardless of sign, per the brief\'s formula', () => {
    // Two components, ±3 and ±5, both sign +1: worst case is simply the sum, ±8.
    const components = [
      component({ id: 'a', tolerance_plus: 3, tolerance_minus: 3, sign: 1 }),
      component({ id: 'b', tolerance_plus: 5, tolerance_minus: 5, sign: 1 }),
    ]
    const totals = worstCaseTotals(components)
    expect(totals.plus).toBe(8)
    expect(totals.minus).toBe(8)
  })

  it('gives the same magnitude whether a symmetric component is sign +1 or -1', () => {
    const plusSign = worstCaseTotals([component({ tolerance_plus: 5, tolerance_minus: 5, sign: 1 })])
    const minusSign = worstCaseTotals([component({ tolerance_plus: 5, tolerance_minus: 5, sign: -1 })])
    expect(plusSign).toEqual(minusSign)
  })

  it('flips which side an asymmetric tolerance lands on when sign is -1', () => {
    const component_ = component({ tolerance_plus: 7, tolerance_minus: 2, sign: -1 })
    const totals = worstCaseTotals([component_])
    // sign -1 means the component's own +tolerance extreme pulls the outcome *down*.
    expect(totals.plus).toBe(2)
    expect(totals.minus).toBe(7)
  })
})

describe('rssTotals — hand-calculated', () => {
  it('root-sum-squares symmetric tolerances, matching nominal ± sqrt(sum(t^2))', () => {
    // ±3 and ±4 RSS to exactly ±5 (3-4-5 triangle).
    const components = [
      component({ id: 'a', tolerance_plus: 3, tolerance_minus: 3, sign: 1 }),
      component({ id: 'b', tolerance_plus: 4, tolerance_minus: 4, sign: 1 }),
    ]
    const totals = rssTotals(components)
    expect(totals.plus).toBeCloseTo(5, 10)
    expect(totals.minus).toBeCloseTo(5, 10)
  })
})

describe('flagRange', () => {
  it('passes when the range sits well within acceptable bounds', () => {
    expect(flagRange(12, 18, 10, 20)).toBe('pass')
  })

  it('fails when the range does not overlap acceptable bounds at all', () => {
    expect(flagRange(25, 30, 10, 20)).toBe('fail')
    expect(flagRange(-5, 5, 10, 20)).toBe('fail')
  })

  it('is at-risk when the range partially overlaps, or creeps into the margin', () => {
    expect(flagRange(15, 25, 10, 20)).toBe('at-risk')
    expect(flagRange(10.5, 19.5, 10, 20)).toBe('at-risk') // inside bounds but within the 10% margin
  })
})

describe('runStackUp — hand-calculated simple example', () => {
  it('matches manual arithmetic for a 3-component chain', () => {
    const junction: Junction = {
      id: 'j1',
      name: 'test junction',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [
        component({ id: 'a', nominal_value: 100, tolerance_plus: 2, tolerance_minus: 2, sign: 1 }),
        component({ id: 'b', nominal_value: 85, tolerance_plus: 3, tolerance_minus: 3, sign: -1 }),
        component({ id: 'c', nominal_value: 0, tolerance_plus: 1, tolerance_minus: 1, sign: 1 }),
      ],
    }

    const result = runStackUp(junction)

    // Nominal: 100 - 85 + 0 = 15
    expect(result.nominal).toBe(15)
    // Worst-case: sum of tolerances = 2 + 3 + 1 = 6 -> [9, 21]
    expect(result.worstCase.min).toBe(9)
    expect(result.worstCase.max).toBe(21)
    // RSS: sqrt(2^2 + 3^2 + 1^2) = sqrt(14) ≈ 3.742 -> [11.258, 18.742]
    expect(result.rss.min).toBeCloseTo(15 - Math.sqrt(14), 10)
    expect(result.rss.max).toBeCloseTo(15 + Math.sqrt(14), 10)

    // Worst-case [9,21] pokes outside [10,20] on both ends but still overlaps -> at-risk
    expect(result.worstCaseFlag).toBe('at-risk')
    // RSS [11.26, 18.74] sits inside the pass margin [11,19] -> pass
    expect(result.rssFlag).toBe('pass')
    expect(result.overallFlag).toBe('at-risk')
  })
})

describe('runStackUp — precast panel to steel frame preset', () => {
  it('produces the expected nominal, worst-case and RSS ranges', () => {
    const result = runStackUp(createPrecastPanelToSteelFramePreset())

    // Nominal: -2985 + 3000 + 0 + 0 = 15
    expect(result.nominal).toBe(15)
    // Worst-case total tolerance: 4 + 6 + 5 + 3 = 18 -> [-3, 33]
    expect(result.worstCase.min).toBe(-3)
    expect(result.worstCase.max).toBe(33)
    // RSS total: sqrt(4^2+6^2+5^2+3^2) = sqrt(86)
    expect(result.rss.min).toBeCloseTo(15 - Math.sqrt(86), 10)
    expect(result.rss.max).toBeCloseTo(15 + Math.sqrt(86), 10)

    // Both ranges straddle the acceptable window without fully escaping it -> at-risk.
    expect(result.worstCaseFlag).toBe('at-risk')
    expect(result.rssFlag).toBe('at-risk')
    expect(result.overallFlag).toBe('at-risk')
  })
})

describe('runStackUp — a junction that is guaranteed to fail', () => {
  it('flags fail when even the best-case combination misses the acceptable range', () => {
    const junction: Junction = {
      id: 'j2',
      name: 'undersized gap',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [component({ id: 'a', nominal_value: 2, tolerance_plus: 1, tolerance_minus: 1, sign: 1 })],
    }

    const result = runStackUp(junction)

    expect(result.nominal).toBe(2)
    expect(result.worstCase).toEqual({ min: 1, max: 3, totalTolerance: 2 })
    expect(result.worstCaseFlag).toBe('fail')
    expect(result.rssFlag).toBe('fail')
    expect(result.overallFlag).toBe('fail')
  })
})
