import { describe, expect, it } from 'vitest'
import {
  checkSequence,
  checkStaticAccess,
  checkToleranceSensitivity,
  flagClearance,
  runBuildabilityCheck,
} from '../buildabilityEngine'
import { Fixing, Junction } from '../types'

function fixing(overrides: Partial<Fixing>): Fixing {
  return {
    id: 'f',
    name: 'fixing',
    type: 'M12 bolt',
    toolType: 'torque wrench',
    requiredClearance: 100,
    nominalAvailableClearance: 120,
    clearanceSensitivity: 0,
    oneSideAccessOnly: false,
    lineOfSightRequired: true,
    mustFollow: [],
    mustPrecede: [],
    ...overrides,
  }
}

describe('flagClearance', () => {
  it('fails when available is below required', () => {
    expect(flagClearance(90, 100)).toBe('fail')
  })

  it('is marginal within the safety margin above required', () => {
    expect(flagClearance(105, 100)).toBe('marginal') // margin is 10% of 100 = 10
  })

  it('passes comfortably above the margin', () => {
    expect(flagClearance(120, 100)).toBe('pass')
  })
})

describe('checkStaticAccess', () => {
  it('matches hand calculation: required 180mm, available 140mm at nominal — fails outright', () => {
    const f = fixing({ requiredClearance: 180, nominalAvailableClearance: 140, clearanceSensitivity: 0 })
    const result = checkStaticAccess(f, { nominal: 15, worstCaseMin: -3, worstCaseMax: 33 })

    expect(result.nominalClearance).toBe(140)
    expect(result.worstCaseClearance).toBe(140) // sensitivity 0 -> unaffected by dimensional variation
    expect(result.nominalFlag).toBe('fail')
    expect(result.worstCaseFlag).toBe('fail')
    expect(result.overallFlag).toBe('fail')
    expect(result.shortfall).toBe(40)
  })

  it('picks the dimensional extreme that shrinks clearance most, for a positive sensitivity', () => {
    // clearance grows with the outcome (sensitivity +1), so the worst case is the *low* extreme.
    const f = fixing({ requiredClearance: 100, nominalAvailableClearance: 120, clearanceSensitivity: 1 })
    const result = checkStaticAccess(f, { nominal: 15, worstCaseMin: 5, worstCaseMax: 25 })

    // clearance at min (5): 120 + 1*(5-15) = 110. clearance at max (25): 120 + 1*(25-15) = 130.
    expect(result.worstCaseClearance).toBe(110)
  })

  it('picks the dimensional extreme that shrinks clearance most, for a negative sensitivity', () => {
    // clearance shrinks as the outcome grows (sensitivity -1), so the worst case is the *high* extreme.
    const f = fixing({ requiredClearance: 100, nominalAvailableClearance: 120, clearanceSensitivity: -1 })
    const result = checkStaticAccess(f, { nominal: 15, worstCaseMin: 5, worstCaseMax: 25 })

    // clearance at min (5): 120 - 1*(5-15) = 130. clearance at max (25): 120 - 1*(25-15) = 110.
    expect(result.worstCaseClearance).toBe(110)
  })

  it('is marginal when nominal fits comfortably but worst-case tolerance eats into the margin', () => {
    const f = fixing({ requiredClearance: 100, nominalAvailableClearance: 120, clearanceSensitivity: -1 })
    const result = checkStaticAccess(f, { nominal: 15, worstCaseMin: 5, worstCaseMax: 30 })
    // worst-case clearance at max (30): 120 - (30-15) = 105 -> within the margin band [100, 110) -> marginal
    expect(result.worstCaseClearance).toBe(105)
    expect(result.nominalFlag).toBe('pass')
    expect(result.worstCaseFlag).toBe('marginal')
    expect(result.overallFlag).toBe('marginal')
    expect(result.shortfall).toBe(0)
  })
})

describe('checkToleranceSensitivity', () => {
  it('reuses the dimensional Monte Carlo outcomes to count clearance failures', () => {
    const f = fixing({ requiredClearance: 100, nominalAvailableClearance: 120, clearanceSensitivity: -1 })
    // outcomes relative to nominal 15: clearance = 120 - (outcome-15)
    const outcomes = [15, 20, 25, 35, 10] // clearances: 120, 115, 110, 100, 125
    const result = checkToleranceSensitivity(f, 15, outcomes)

    expect(result.runs).toBe(5)
    expect(result.clearanceFailCount).toBe(0) // none strictly below 100
    expect(result.worstClearance).toBe(100)
    expect(result.flag).toBe('marginal') // 100 is within the 10% margin, not below required
  })

  it('counts a run as a clearance failure once it drops below the requirement', () => {
    const f = fixing({ requiredClearance: 100, nominalAvailableClearance: 120, clearanceSensitivity: -1 })
    const outcomes = [15, 40] // clearances: 120, 95
    const result = checkToleranceSensitivity(f, 15, outcomes)

    expect(result.clearanceFailCount).toBe(1)
    expect(result.clearanceFailRate).toBe(0.5)
    expect(result.flag).toBe('fail')
  })
})

describe('checkSequence', () => {
  it('is satisfiable for a simple linear chain', () => {
    const fixings = [
      fixing({ id: 'a', name: 'A' }),
      fixing({ id: 'b', name: 'B', mustFollow: ['a'] }),
      fixing({ id: 'c', name: 'C', mustFollow: ['b'] }),
    ]
    const result = checkSequence(fixings)

    expect(result.satisfiable).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b'))
    expect(result.order.indexOf('b')).toBeLessThan(result.order.indexOf('c'))
  })

  it('treats mustPrecede as an equivalent before-edge in the other direction', () => {
    const fixings = [fixing({ id: 'a', name: 'A', mustPrecede: ['b'] }), fixing({ id: 'b', name: 'B' })]
    const result = checkSequence(fixings)

    expect(result.satisfiable).toBe(true)
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b'))
  })

  it('flags a circular dependency as unsatisfiable', () => {
    const fixings = [
      fixing({ id: 'a', name: 'A', mustFollow: ['b'] }),
      fixing({ id: 'b', name: 'B', mustFollow: ['a'] }),
    ]
    const result = checkSequence(fixings)

    expect(result.satisfiable).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].fixingIds.sort()).toEqual(['a', 'b'])
  })

  it('flags a reference to an unknown fixing id', () => {
    const fixings = [fixing({ id: 'a', name: 'A', mustFollow: ['does-not-exist'] })]
    const result = checkSequence(fixings)

    expect(result.satisfiable).toBe(false)
    expect(result.issues[0].reason).toMatch(/unknown fixing id/)
  })
})

describe('runBuildabilityCheck', () => {
  it('combines static access, tolerance sensitivity and sequence into a per-fixing and overall flag', () => {
    const junction: Junction = {
      id: 'j',
      name: 'test junction',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [],
      fixings: [
        fixing({ id: 'good', name: 'Good fixing', requiredClearance: 50, nominalAvailableClearance: 200 }),
        fixing({ id: 'tight', name: 'Tight fixing', requiredClearance: 180, nominalAvailableClearance: 140 }),
      ],
    }

    const result = runBuildabilityCheck(junction, { nominal: 15, worstCaseMin: -3, worstCaseMax: 33 })

    expect(result.fixings).toHaveLength(2)
    const good = result.fixings.find((f) => f.fixingId === 'good')!
    const tight = result.fixings.find((f) => f.fixingId === 'tight')!
    expect(good.overallFlag).toBe('pass')
    expect(tight.overallFlag).toBe('fail')
    expect(tight.staticAccess.shortfall).toBe(40)
    expect(result.overallFlag).toBe('fail')
    expect(result.sequence.satisfiable).toBe(true)
  })

  it('forces a fixing to fail when its sequence position is unsatisfiable, even with ample clearance', () => {
    const junction: Junction = {
      id: 'j',
      name: 'test junction',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [],
      fixings: [
        fixing({ id: 'a', name: 'A', requiredClearance: 10, nominalAvailableClearance: 200, mustFollow: ['b'] }),
        fixing({ id: 'b', name: 'B', requiredClearance: 10, nominalAvailableClearance: 200, mustFollow: ['a'] }),
      ],
    }

    const result = runBuildabilityCheck(junction, { nominal: 15, worstCaseMin: 10, worstCaseMax: 20 })

    expect(result.fixings.every((f) => f.overallFlag === 'fail')).toBe(true)
    expect(result.fixings.every((f) => f.sequenceOk === false)).toBe(true)
    expect(result.overallFlag).toBe('fail')
  })

  it('returns a passing, empty-fixings result for a junction with no fixings defined', () => {
    const junction: Junction = {
      id: 'j',
      name: 'test junction',
      type: 'test',
      requirement: { parameter: 'gap', acceptable_min: 10, acceptable_max: 20, unit: 'mm' },
      components: [],
    }

    const result = runBuildabilityCheck(junction, { nominal: 15, worstCaseMin: 10, worstCaseMax: 20 })
    expect(result.fixings).toEqual([])
    expect(result.overallFlag).toBe('pass')
    expect(result.sequence.satisfiable).toBe(true)
  })
})
