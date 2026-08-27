// Backtest-driven parameter tuning: not machine learning, just replaying the
// existing signal + paper-trading logic against a small grid of parameter
// combinations over real history, and adopting whichever would have
// performed best - with an out-of-sample check so a combo that only looks
// good because it happened to fit historical noise doesn't get adopted.

import { computeSignals, DEFAULT_PARAMS, SignalParams } from './stockSignals'
import { reconcileTicker } from './paperTrading'
import { fetchDailyCloses } from './yahooFinance'
import { createWatchlistAdminClient } from './supabase/watchlistAdmin'

const SMA_SHORT_CANDIDATES = [20, 50]
const SMA_LONG_CANDIDATES = [100, 150, 200]
const RSI_CANDIDATES: [number, number][] = [
  [25, 75],
  [30, 70],
  [35, 65],
]
const ADX_THRESHOLD_CANDIDATES = [20, 25, 30]

// The window's own SMA short/long windows must stay ordered (short < long) -
// filtered out below rather than encoded in the candidate lists themselves,
// since every SMA_SHORT_CANDIDATES value is already < every
// SMA_LONG_CANDIDATES value here, but this guards the invariant explicitly
// in case the candidate lists change later.
function buildGrid(): SignalParams[] {
  const grid: SignalParams[] = []
  for (const smaShort of SMA_SHORT_CANDIDATES) {
    for (const smaLong of SMA_LONG_CANDIDATES) {
      if (smaShort >= smaLong) continue
      for (const [rsiOversold, rsiOverbought] of RSI_CANDIDATES) {
        for (const adxThreshold of ADX_THRESHOLD_CANDIDATES) {
          grid.push({ smaShort, smaLong, rsiOversold, rsiOverbought, adxThreshold })
        }
      }
    }
  }
  return grid
}

// Average % return per simulated flat-investment trade over the given slice
// (equal-weighted, since every trade invests the same amount) - reuses the
// same reconciliation pairing already built and unit-tested for the live
// paper-trading ledger, just replayed in-memory instead of persisted. Null
// when the combo produces no trades at all over this slice (nothing to
// evaluate it on).
function computeSimulatedReturnPct(
  dates: string[],
  close: number[],
  high: number[],
  low: number[],
  params: SignalParams
): number | null {
  if (dates.length === 0) return null
  const { signals } = computeSignals(dates, close, high, low, params)
  const { toInsert, toClose } = reconcileTicker('TICKER', 'USD', null, null, signals, close)
  const closeByEntryDate = new Map(toClose.map((c) => [c.entry_date, c]))

  const returns: number[] = []
  const lastClose = close[close.length - 1]
  for (const trade of toInsert) {
    const closeInfo = closeByEntryDate.get(trade.entry_date)
    const exitPrice = closeInfo ? closeInfo.exit_price : lastClose // still open - mark to the slice's last close
    returns.push(((exitPrice - trade.entry_price) / trade.entry_price) * 100)
  }

  if (returns.length === 0) return null
  return returns.reduce((a, b) => a + b, 0) / returns.length
}

export interface TuneResult {
  params: SignalParams
  isTuned: boolean
  backtestReturnPct: number
  validatedReturnPct: number
}

// Pure grid-search core - no I/O, so it's cheap to unit-test the in-sample/
// out-of-sample gate directly against synthetic price series. Tunes on the
// first ~70% of the given history, validates the winner (and the defaults,
// for comparison) on the held-out final ~30%. Only returns isTuned: true if
// the tuned combo actually beat the defaults on that held-out slice -
// otherwise the defaults are what's recorded, with both scores kept for
// transparency about what was tried. Null if there's not enough history for
// a meaningful split.
export function tuneFromHistory(
  dates: string[],
  close: number[],
  high: number[],
  low: number[]
): TuneResult | null {
  const n = dates.length
  if (n < 300) return null // not enough history for a meaningful in/out-of-sample split

  const splitIdx = Math.floor(n * 0.7)
  const inSample = {
    dates: dates.slice(0, splitIdx),
    close: close.slice(0, splitIdx),
    high: high.slice(0, splitIdx),
    low: low.slice(0, splitIdx),
  }
  const outOfSample = {
    dates: dates.slice(splitIdx),
    close: close.slice(splitIdx),
    high: high.slice(splitIdx),
    low: low.slice(splitIdx),
  }

  let best: { params: SignalParams; inSampleReturn: number } | null = null
  for (const candidate of buildGrid()) {
    const inSampleReturn = computeSimulatedReturnPct(
      inSample.dates,
      inSample.close,
      inSample.high,
      inSample.low,
      candidate
    )
    if (inSampleReturn == null) continue
    if (best === null || inSampleReturn > best.inSampleReturn) {
      best = { params: candidate, inSampleReturn }
    }
  }

  const defaultOutOfSample = computeSimulatedReturnPct(
    outOfSample.dates,
    outOfSample.close,
    outOfSample.high,
    outOfSample.low,
    DEFAULT_PARAMS
  )
  const bestOutOfSample =
    best !== null
      ? computeSimulatedReturnPct(outOfSample.dates, outOfSample.close, outOfSample.high, outOfSample.low, best.params)
      : null
  const defaultInSample = computeSimulatedReturnPct(
    inSample.dates,
    inSample.close,
    inSample.high,
    inSample.low,
    DEFAULT_PARAMS
  )

  return decideTuneResult(best, bestOutOfSample, defaultInSample, defaultOutOfSample)
}

// The overfitting guard, isolated as its own pure decision so it can be
// unit-tested directly with hand-picked numbers rather than requiring price
// data engineered to produce a specific overfit pattern: a tuned combo is
// only adopted if it beats the defaults on data the tuning itself never saw.
export function decideTuneResult(
  best: { params: SignalParams; inSampleReturn: number } | null,
  bestOutOfSample: number | null,
  defaultInSample: number | null,
  defaultOutOfSample: number | null
): TuneResult {
  if (best !== null && bestOutOfSample != null && (defaultOutOfSample == null || bestOutOfSample > defaultOutOfSample)) {
    return {
      params: best.params,
      isTuned: true,
      backtestReturnPct: best.inSampleReturn,
      validatedReturnPct: bestOutOfSample,
    }
  }
  return {
    params: DEFAULT_PARAMS,
    isTuned: false,
    backtestReturnPct: defaultInSample ?? 0,
    validatedReturnPct: defaultOutOfSample ?? 0,
  }
}

// Thin I/O wrapper: fetches 5 years of history for the ticker, then hands it
// to the pure tuneFromHistory above.
export async function tuneTicker(ticker: string): Promise<TuneResult | null> {
  const result = await fetchDailyCloses(ticker, '5y')
  if (!result.ok) return null
  const { dates, close, high, low } = result.data
  return tuneFromHistory(dates, close, high, low)
}

export async function upsertSignalParams(ticker: string, result: TuneResult): Promise<void> {
  await createWatchlistAdminClient()
    .from('signal_params')
    .upsert(
      {
        ticker,
        sma_short: result.params.smaShort,
        sma_long: result.params.smaLong,
        rsi_oversold: result.params.rsiOversold,
        rsi_overbought: result.params.rsiOverbought,
        adx_threshold: result.params.adxThreshold,
        is_tuned: result.isTuned,
        backtest_return_pct: result.backtestReturnPct,
        validated_return_pct: result.validatedReturnPct,
        tuned_at: new Date().toISOString(),
      },
      { onConflict: 'ticker' }
    )
}

export interface StoredSignalParams {
  params: SignalParams
  tuned: boolean
  tunedAt?: string
  backtestReturnPct?: number
  validatedReturnPct?: number
}

// Read-side lookup used by the live signal routes. Falls back to the
// built-in defaults whenever there's no tuned row yet (brand new ticker,
// cron hasn't run since it was added) or the row's `is_tuned` is false (the
// weekly tuning run tried, but the defaults still won out-of-sample) - or if
// the Watchlist project is unreachable, since a tuning lookup failing should
// never break the signal computation it's only meant to improve.
export async function getSignalParams(ticker: string): Promise<StoredSignalParams> {
  try {
    const { data } = await createWatchlistAdminClient()
      .from('signal_params')
      .select('sma_short, sma_long, rsi_oversold, rsi_overbought, adx_threshold, is_tuned, tuned_at, backtest_return_pct, validated_return_pct')
      .eq('ticker', ticker)
      .maybeSingle()

    if (!data || !data.is_tuned) return { params: DEFAULT_PARAMS, tuned: false }

    return {
      params: {
        smaShort: data.sma_short,
        smaLong: data.sma_long,
        rsiOversold: data.rsi_oversold,
        rsiOverbought: data.rsi_overbought,
        adxThreshold: data.adx_threshold,
      },
      tuned: true,
      tunedAt: data.tuned_at,
      backtestReturnPct: data.backtest_return_pct,
      validatedReturnPct: data.validated_return_pct,
    }
  } catch {
    return { params: DEFAULT_PARAMS, tuned: false }
  }
}
