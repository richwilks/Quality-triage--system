// Real-money counterpart to lib/paperTrading.ts - reuses its exact
// reconcileTicker flip logic (BUY only when flat, SELL only when open) so
// the two can never drift apart, but persists to live_trades/
// live_trade_log and places real orders via lib/trading212.ts instead of
// just writing a simulated ledger row.
//
// Only ever called for a user whose trading212_settings.enabled is true -
// callers (the two crons) are responsible for that gate, same as
// confidence_mode is checked by the caller rather than in here.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockSignal } from './stockSignals'
import { reconcileTicker, type ReconcileResult } from './paperTrading'
import { getAccountCash, getInstrumentCode, placeMarketOrder, type Trading212Env } from './trading212'

export interface Trading212Settings {
  enabled: boolean
  environment: Trading212Env
  risk_pct: number
  // A dedicated trading allowance, deliberately independent of the real
  // account's cash balance (see computeNetAvailableBudget) - null means
  // uncapped (falls back to sizing off real account cash, the original
  // behavior before this existed). Compared against raw numbers with no
  // currency conversion: every current ticker trades in USD, so on a
  // GBP-denominated limit this is conservative right now (it stops sooner
  // than a true £-equivalent cap would, since £1 currently buys more than
  // $1) - but isn't generally currency-correct. Set the limit in whichever
  // currency most of your positions trade in for predictable behavior.
  max_total_investment: number | null
}

export async function getTrading212Settings(
  supabase: SupabaseClient,
  userId: string
): Promise<Trading212Settings | null> {
  const { data } = await supabase
    .from('trading212_settings')
    .select('enabled, environment, risk_pct, max_total_investment')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || !data.enabled) return null
  return {
    enabled: data.enabled,
    environment: data.environment,
    risk_pct: data.risk_pct,
    max_total_investment: data.max_total_investment,
  }
}

// Pure, so it's cheap to unit-test in isolation from the Supabase/Trading
// 212 I/O around it. Floors to a whole share - Trading 212's market-order
// endpoint takes a quantity, and this app doesn't assume fractional-share
// support. Returns 0 (never negative) when the allocation can't afford even
// one share, so callers can treat "skip, don't place a zero-quantity order"
// as the single condition `quantity <= 0`.
export function calculatePositionSize(cash: number, riskPct: number, price: number): number {
  if (!Number.isFinite(cash) || !Number.isFinite(riskPct) || !Number.isFinite(price) || price <= 0) return 0
  return Math.max(0, Math.floor((cash * (riskPct / 100)) / price))
}

// Pure, so it's cheap to unit-test in isolation. This is a dedicated
// trading allowance, not a percentage of whatever else sits in the real
// account - deliberately independent of account cash. It depletes two
// ways: capital currently tied up in open positions, and cumulative
// realized losses (a losing trade spends the budget just as surely as an
// open position does; a realized gain gives some of it back). Once this
// reaches zero - fully invested right now, or lost outright - callers
// must stop opening new positions; the only ways back are an open
// position closing (frees currentlyInvested) or the user raising
// maxTotalInvestment themselves (a deliberate "top up", never automatic).
export function computeNetAvailableBudget(
  maxTotalInvestment: number,
  cumulativeRealizedPnl: number,
  currentlyInvested: number
): number {
  return maxTotalInvestment + cumulativeRealizedPnl - currentlyInvested
}

async function logAttempt(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  side: 'BUY' | 'SELL',
  environment: Trading212Env,
  fields: { quantity?: number; trading212_order_id?: string; status: 'placed' | 'rejected' | 'error' | 'skipped'; error_message?: string }
): Promise<void> {
  await supabase.from('live_trade_log').insert({ user_id: userId, ticker, side, environment, ...fields })
}

// Mirrors reconcileAndPersist's read step (lib/paperTrading.ts), scoped
// additionally by environment so a ticker's demo and live history never
// cross-contaminate each other's open/closed state.
async function readLedgerState(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  environment: Trading212Env
): Promise<{ openEntryDate: string | null; cutoffDate: string | null }> {
  const { data: existingRows } = await supabase
    .from('live_trades')
    .select('entry_date, exit_date, status')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .eq('environment', environment)

  const rows = existingRows || []
  const openRow = rows.find((r) => r.status === 'open')
  const openEntryDate: string | null = openRow ? openRow.entry_date : null

  let cutoffDate: string | null = null
  for (const r of rows) {
    const latest = r.exit_date ?? r.entry_date
    if (cutoffDate === null || latest > cutoffDate) cutoffDate = latest
  }

  return { openEntryDate, cutoffDate }
}

// Sums cost basis (quantity * entry_price) across every OPEN position for
// this user+environment, across ALL tickers - the total-investment cap is
// portfolio-wide, not per-ticker.
async function getCurrentlyInvested(supabase: SupabaseClient, userId: string, environment: Trading212Env): Promise<number> {
  const { data } = await supabase
    .from('live_trades')
    .select('quantity, entry_price')
    .eq('user_id', userId)
    .eq('environment', environment)
    .eq('status', 'open')
  return (data || []).reduce((sum, r) => sum + r.quantity * r.entry_price, 0)
}

// Sums realized P&L (quantity * (exit_price - entry_price)) across every
// CLOSED position for this user+environment, across ALL tickers - this is
// what lets a losing streak permanently eat into the budget (never
// replayed/reset by itself) while a winning one gives some of it back.
async function getCumulativeRealizedPnl(supabase: SupabaseClient, userId: string, environment: Trading212Env): Promise<number> {
  const { data } = await supabase
    .from('live_trades')
    .select('quantity, entry_price, exit_price')
    .eq('user_id', userId)
    .eq('environment', environment)
    .eq('status', 'closed')
  return (data || []).reduce((sum, r) => sum + r.quantity * ((r.exit_price ?? r.entry_price) - r.entry_price), 0)
}

export async function reconcileAndPersistLive(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  currency: string,
  settings: Trading212Settings,
  actionableSignals: StockSignal[],
  close: number[]
): Promise<ReconcileResult> {
  const { environment, risk_pct, max_total_investment } = settings
  const { openEntryDate, cutoffDate } = await readLedgerState(supabase, userId, ticker, environment)
  const result = reconcileTicker(ticker, currency, openEntryDate, cutoffDate, actionableSignals, close)

  for (const t of result.toInsert) {
    let quantity: number

    if (max_total_investment != null) {
      // A dedicated trading allowance, not a percentage of the real
      // account - account cash is never consulted here at all.
      const currentlyInvested = await getCurrentlyInvested(supabase, userId, environment)
      const cumulativeRealizedPnl = await getCumulativeRealizedPnl(supabase, userId, environment)
      const netAvailableBudget = computeNetAvailableBudget(max_total_investment, cumulativeRealizedPnl, currentlyInvested)
      if (netAvailableBudget <= 0) {
        await logAttempt(supabase, userId, ticker, 'BUY', environment, {
          status: 'skipped',
          error_message: `Trading budget of ${max_total_investment} exhausted (currently invested ${currentlyInvested}, realized P&L ${cumulativeRealizedPnl.toFixed(2)}) - raise the total investment limit to resume`,
        })
        continue
      }
      quantity = calculatePositionSize(netAvailableBudget, risk_pct, t.entry_price)
      if (quantity <= 0) {
        await logAttempt(supabase, userId, ticker, 'BUY', environment, {
          status: 'skipped',
          error_message: `${risk_pct}% of remaining budget ${netAvailableBudget.toFixed(2)} at ${t.entry_price}/share rounded down to 0 shares`,
        })
        continue
      }
    } else {
      // No budget configured - fall back to sizing off the real account
      // balance, same as before a total investment limit existed.
      const cashResult = await getAccountCash(environment)
      if (!cashResult.ok) {
        await logAttempt(supabase, userId, ticker, 'BUY', environment, { status: 'error', error_message: cashResult.error })
        continue
      }
      quantity = calculatePositionSize(cashResult.data.cash, risk_pct, t.entry_price)
      if (quantity <= 0) {
        await logAttempt(supabase, userId, ticker, 'BUY', environment, {
          status: 'skipped',
          error_message: `${risk_pct}% of ${cashResult.data.cash} at ${t.entry_price}/share rounded down to 0 shares`,
        })
        continue
      }
    }

    const instrumentCode = await getInstrumentCode(supabase, environment, ticker)
    if (!instrumentCode) {
      await logAttempt(supabase, userId, ticker, 'BUY', environment, {
        quantity,
        status: 'error',
        error_message: `Could not resolve a Trading 212 instrument code for ${ticker}`,
      })
      continue
    }

    const orderResult = await placeMarketOrder(environment, instrumentCode, quantity)
    if (!orderResult.ok) {
      await logAttempt(supabase, userId, ticker, 'BUY', environment, { quantity, status: 'error', error_message: orderResult.error })
      continue
    }

    // Written synchronously, right after the order succeeds, before this
    // function returns - the same sequencing reconcileAndPersist already
    // relies on (lib/paperTrading.ts) so the next cron tick sees an open
    // position and never re-fires this BUY.
    await supabase.from('live_trades').insert({
      user_id: userId,
      ticker,
      currency,
      environment,
      entry_date: t.entry_date,
      entry_price: orderResult.data.fillPrice ?? t.entry_price,
      entry_strategy: t.entry_strategy,
      entry_detail: t.entry_detail,
      quantity,
      trading212_order_id: orderResult.data.orderId,
      status: 'open',
    })
    await logAttempt(supabase, userId, ticker, 'BUY', environment, { quantity, trading212_order_id: orderResult.data.orderId, status: 'placed' })
  }

  for (const c of result.toClose) {
    const { data: openRow } = await supabase
      .from('live_trades')
      .select('quantity')
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .eq('environment', environment)
      .eq('entry_date', c.entry_date)
      .maybeSingle()

    if (!openRow) continue // nothing was ever actually opened for this entry - never sell shares we don't have a record of

    const instrumentCode = await getInstrumentCode(supabase, environment, ticker)
    if (!instrumentCode) {
      await logAttempt(supabase, userId, ticker, 'SELL', environment, {
        quantity: openRow.quantity,
        status: 'error',
        error_message: `Could not resolve a Trading 212 instrument code for ${ticker}`,
      })
      continue
    }

    // Sell the exact quantity recorded on open, never recomputed - a
    // negative quantity is Trading 212's sell direction for the same
    // market-order endpoint used to buy.
    const orderResult = await placeMarketOrder(environment, instrumentCode, -openRow.quantity)
    if (!orderResult.ok) {
      await logAttempt(supabase, userId, ticker, 'SELL', environment, { quantity: openRow.quantity, status: 'error', error_message: orderResult.error })
      continue // leave the position marked open - we don't know it actually sold, so the ledger must not claim it did
    }

    await supabase
      .from('live_trades')
      .update({
        exit_date: c.exit_date,
        exit_price: orderResult.data.fillPrice ?? c.exit_price,
        exit_strategy: c.exit_strategy,
        exit_detail: c.exit_detail,
        exit_order_id: orderResult.data.orderId,
        status: 'closed',
      })
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .eq('environment', environment)
      .eq('entry_date', c.entry_date)
    await logAttempt(supabase, userId, ticker, 'SELL', environment, { quantity: openRow.quantity, trading212_order_id: orderResult.data.orderId, status: 'placed' })
  }

  return result
}
