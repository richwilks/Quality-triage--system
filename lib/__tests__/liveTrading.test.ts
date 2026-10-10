import { describe, expect, it } from 'vitest'
import { calculatePositionSize, capQuantityForInvestmentLimit } from '../liveTrading'

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

describe('capQuantityForInvestmentLimit', () => {
  it('returns the quantity unchanged when uncapped (null/undefined)', () => {
    expect(capQuantityForInvestmentLimit(5, 100, 0, null)).toBe(5)
    expect(capQuantityForInvestmentLimit(5, 100, 0, undefined)).toBe(5)
  })

  it('shrinks the quantity to fit remaining headroom under the cap', () => {
    // 200 limit, 150 already invested -> 50 headroom -> at 20/share, 2 shares fit, not the original 5
    expect(capQuantityForInvestmentLimit(5, 20, 150, 200)).toBe(2)
  })

  it('never grows the quantity even when headroom exceeds the risk-sized amount', () => {
    // plenty of headroom (200 limit, 0 invested) - still capped at the original risk-sized 3, not more
    expect(capQuantityForInvestmentLimit(3, 20, 0, 200)).toBe(3)
  })

  it('returns 0 once the limit is already reached or exceeded', () => {
    expect(capQuantityForInvestmentLimit(5, 20, 200, 200)).toBe(0)
    expect(capQuantityForInvestmentLimit(5, 20, 250, 200)).toBe(0)
  })

  it('returns 0 rather than a fractional share when headroom cannot afford one', () => {
    // 200 limit, 190 invested -> 10 headroom -> at 20/share, 0.5 shares -> floors to 0
    expect(capQuantityForInvestmentLimit(5, 20, 190, 200)).toBe(0)
  })
})
