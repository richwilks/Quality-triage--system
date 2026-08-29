import type { NewTrade, TradeClose } from './paperTrading'
import { INVESTED_AMOUNT } from './paperTrading'

// Pure pairing/summing logic for the "what if?" backtest, split out from
// the route handler so it's cheap to unit-test with synthetic data.
// reconcileTicker (lib/paperTrading.ts) emits toInsert/toClose in the same
// relative order the state machine encountered them - since only one
// position is ever open at a time, toInsert[i] is always the trade that
// toClose[i] closes, for i < toClose.length. Anything past that is the
// still-open position at the end of the series, if any.
export interface TickerBacktestSummary {
  trades: number
  invested: number
  pnl: number
  returnPct: number | null
  stillOpen: boolean
}

export function summarizeBacktest(toInsert: NewTrade[], toClose: TradeClose[], windowStartDate: string): TickerBacktestSummary {
  let trades = 0
  let invested = 0
  let pnl = 0

  for (let i = 0; i < toClose.length; i++) {
    const open = toInsert[i]
    const close = toClose[i]
    if (!open || open.entry_date < windowStartDate) continue
    trades += 1
    invested += INVESTED_AMOUNT
    pnl += (INVESTED_AMOUNT / open.entry_price) * (close.exit_price - open.entry_price)
  }

  const lastOpen = toInsert[toInsert.length - 1]
  const stillOpen = toInsert.length > toClose.length && !!lastOpen && lastOpen.entry_date >= windowStartDate

  return { trades, invested, pnl, returnPct: trades > 0 ? (pnl / invested) * 100 : null, stillOpen }
}
