import { describe, expect, it } from 'vitest'
import { calculatePositionSize } from '../liveTrading'

describe('calculatePositionSize', () => {
  it('floors to a whole share from cash * riskPct / price', () => {
    // 10,000 * 2% = 200; 200 / 150 = 1.33 -> 1 share
    expect(calculatePositionSize(10000, 2, 150)).toBe(1)
    // 10,000 * 2% = 200; 200 / 40 = 5 shares exactly
    expect(calculatePositionSize(10000, 2, 40)).toBe(5)
  })

  it('returns 0 (never negative) when the allocation cannot afford one share', () => {
    // 1,000 * 2% = 20; 20 / 900 (e.g. an expensive stock on a small
    // account) rounds down to 0, not a fractional/negative quantity.
    expect(calculatePositionSize(1000, 2, 900)).toBe(0)
  })

  it('returns 0 for non-finite or non-positive inputs rather than throwing or returning NaN/Infinity', () => {
    expect(calculatePositionSize(NaN, 2, 100)).toBe(0)
    expect(calculatePositionSize(10000, 2, 0)).toBe(0)
    expect(calculatePositionSize(10000, 2, -50)).toBe(0)
    expect(calculatePositionSize(Infinity, 2, 100)).toBe(0)
  })

  it('scales with risk percentage', () => {
    expect(calculatePositionSize(10000, 1, 100)).toBe(1) // 1% of 10,000 = 100 -> 1 share
    expect(calculatePositionSize(10000, 5, 100)).toBe(5) // 5% of 10,000 = 500 -> 5 shares
  })
})
