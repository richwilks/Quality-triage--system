import { describe, expect, it } from 'vitest'
import { calculatePositionSize, computeNetAvailableBudget } from '../liveTrading'

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

describe('computeNetAvailableBudget', () => {
  it('starts at the full limit when nothing is invested and nothing realized yet', () => {
    expect(computeNetAvailableBudget(200, 0, 0)).toBe(200)
  })

  it('shrinks by whatever is currently tied up in open positions', () => {
    // 200 limit, 150 currently open, no realized history yet -> 50 left
    expect(computeNetAvailableBudget(200, 0, 150)).toBe(50)
  })

  it('shrinks further by cumulative realized losses - a loss spends the budget just like an open position', () => {
    // 200 limit, nothing open right now, but 80 lost on past closed trades -> 120 left
    expect(computeNetAvailableBudget(200, -80, 0)).toBe(120)
  })

  it('gives some budget back on net realized gains', () => {
    // 200 limit, nothing open, +30 realized gain so far -> 230 left
    expect(computeNetAvailableBudget(200, 30, 0)).toBe(230)
  })

  it('goes to zero or negative once the limit is fully invested or lost - the "wait for a top up" state', () => {
    expect(computeNetAvailableBudget(200, 0, 200)).toBe(0) // fully invested right now
    expect(computeNetAvailableBudget(200, -200, 0)).toBe(0) // lost the whole budget
    expect(computeNetAvailableBudget(200, -250, 0)).toBe(-50) // lost more than the budget
  })

  it('only comes back up via an open position closing or the limit itself being raised - never by itself', () => {
    // simulates: budget exhausted by losses, then the user raises the limit (the "top up")
    const exhausted = computeNetAvailableBudget(200, -200, 0)
    expect(exhausted).toBe(0)
    const toppedUp = computeNetAvailableBudget(400, -200, 0)
    expect(toppedUp).toBe(200)
  })
})
