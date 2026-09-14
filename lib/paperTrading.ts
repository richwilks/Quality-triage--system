// Simulates a flat "invest INVESTED_AMOUNT at every BUY, sell at the next
// SELL" strategy per ticker, so a user can see what following the signals
// as they actually fire would earn - without risking real money. One
// position per ticker at a time: either strategy's BUY opens it if flat,
// either strategy's SELL closes it if open (not tracked separately per
// strategy). Callers only ever pass in signals dated "today" (see the two
// crons), never a ticker's whole fetched history - this is a live,
// forward-only ledger, not a backtest.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockSignal } from './stockSignals'
import { strategyLabel } from './stockSignals'

export const INVESTED_AMOUNT = 100

export interface NewTrade {
  ticker: string
  currency: string
  entry_date: string
  entry_price: number
  entry_strategy: string
  entry_detail: string
  invested_amount: number
  shares: number
}

export interface TradeClose {
  entry_date: string
  exit_date: string
  exit_price: number
  exit_strategy: string
  exit_detail: string
}

export interface ReconcileResult {
  toInsert: NewTrade[]
  toClose: TradeClose[]
}

// Pure function - no I/O, so it's cheap to unit-test in isolation.
//
// `openEntryDate` is the entry date of the currently-open position for this
// ticker (or null if flat). `cutoffDate` is the latest date already reflected
// in the ledger - the entry or exit date of the most recent trade recorded
// for this ticker, across BOTH open and closed trades - or null if none
// exist yet. Every signal at or before that cutoff has already been applied
// in a prior run and MUST be skipped, not replayed: replaying old signals
// against a state that has since moved on (e.g. a since-closed and reopened
// position) would misattribute a stale SELL to the wrong entry. Only signals
// strictly after the cutoff are new work.
export function reconcileTicker(
  ticker: string,
  currency: string,
  openEntryDate: string | null,
  cutoffDate: string | null,
  signals: StockSignal[],
  close: number[]
): ReconcileResult {
  const toInsert: NewTrade[] = []
  const toClose: TradeClose[] = []
  let open = openEntryDate

  for (const signal of signals) {
    if (cutoffDate !== null && signal.date <= cutoffDate) continue

    if (signal.action === 'BUY' && open === null) {
      const price = close[signal.index]
      toInsert.push({
        ticker,
        currency,
        entry_date: signal.date,
        entry_price: price,
        entry_strategy: signal.strategy,
        entry_detail: signal.detail,
        invested_amount: INVESTED_AMOUNT,
        shares: INVESTED_AMOUNT / price,
      })
      open = signal.date
    } else if (signal.action === 'SELL' && open !== null) {
      toClose.push({
        entry_date: open,
        exit_date: signal.date,
        exit_price: close[signal.index],
        exit_strategy: signal.strategy,
        exit_detail: signal.detail,
      })
      open = null
    }
  }

  return { toInsert, toClose }
}

// Supabase-aware wrapper: derives the open position and the reconciliation
// cutoff from every trade already recorded for this ticker, reconciles, and
// applies inserts/updates. Works with either a user-session client or a
// service-role client (the cron route uses the latter, since it has no user
// session to scope queries to).
export async function reconcileAndPersist(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  currency: string,
  signals: StockSignal[],
  close: number[]
): Promise<ReconcileResult> {
  const { data: existingRows } = await supabase
    .from('paper_trades')
    .select('entry_date, exit_date, status')
    .eq('user_id', userId)
    .eq('ticker', ticker)

  const rows = existingRows || []
  const openRow = rows.find((r) => r.status === 'open')
  const openEntryDate: string | null = openRow ? openRow.entry_date : null

  let cutoffDate: string | null = null
  for (const r of rows) {
    const latest = r.exit_date ?? r.entry_date
    if (cutoffDate === null || latest > cutoffDate) cutoffDate = latest
  }

  const result = reconcileTicker(ticker, currency, openEntryDate, cutoffDate, signals, close)

  if (result.toInsert.length > 0) {
    await supabase
      .from('paper_trades')
      .upsert(
        result.toInsert.map((t) => ({ ...t, user_id: userId, status: 'open' })),
        { onConflict: 'user_id,ticker,entry_date', ignoreDuplicates: true }
      )
  }

  for (const c of result.toClose) {
    await supabase
      .from('paper_trades')
      .update({
        exit_date: c.exit_date,
        exit_price: c.exit_price,
        exit_strategy: c.exit_strategy,
        exit_detail: c.exit_detail,
        status: 'closed',
      })
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .eq('entry_date', c.entry_date)
  }

  return result
}

export interface StrategyAccuracy {
  strategy: string
  label: string
  closedCount: number
  winRatePct: number
  avgReturnPct: number
}

// "Which of our signals are actually right" scoreboard - grouped by
// whichever strategy opened the trade (the call being graded), across every
// ticker/currency the user holds (return_pct is already currency-agnostic,
// so these average cleanly even when the trades themselves aren't). Only
// closed trades count: an open position's outcome isn't final yet, so
// including it here would grade a call before it's actually settled. Pure
// function over already-computed return_pct so it's cheap to unit-test and
// works the same whether it's grading one ticker's history or a whole
// account's.
export function computeStrategyAccuracy(
  trades: { entry_strategy: string; status: 'open' | 'closed'; return_pct: number }[]
): StrategyAccuracy[] {
  const byStrategy = new Map<string, { wins: number; count: number; totalReturnPct: number }>()

  for (const t of trades) {
    if (t.status !== 'closed') continue
    const s = byStrategy.get(t.entry_strategy) || { wins: 0, count: 0, totalReturnPct: 0 }
    s.count += 1
    s.totalReturnPct += t.return_pct
    if (t.return_pct > 0) s.wins += 1
    byStrategy.set(t.entry_strategy, s)
  }

  return [...byStrategy.entries()]
    .map(([strategy, s]) => ({
      strategy,
      label: strategyLabel(strategy),
      closedCount: s.count,
      winRatePct: (s.wins / s.count) * 100,
      avgReturnPct: s.totalReturnPct / s.count,
    }))
    .sort((a, b) => b.closedCount - a.closedCount)
}
