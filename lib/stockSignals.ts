// TypeScript port of the SMA-crossover / RSI signal logic in
// stock-signal-monitor/signals.py, adapted to scan an entire price history
// (rather than just the latest day) so the dashboard chart can mark every
// past BUY/SELL point, not only the most recent one. Extended with MACD (a
// second, faster crossover signal) and ADX (a trend-strength filter on both
// crossover signals - see computeSignals for why RSI is deliberately not
// filtered by it).

export const SMA_SHORT_WINDOW = 50
export const SMA_LONG_WINDOW = 200
export const RSI_WINDOW = 14
export const RSI_OVERSOLD_THRESHOLD = 30
export const RSI_OVERBOUGHT_THRESHOLD = 70
export const RSI_WATCH_MARGIN = 5
export const ADX_WINDOW = 14
export const ADX_THRESHOLD = 25
export const MACD_FAST_WINDOW = 12
export const MACD_SLOW_WINDOW = 26
export const MACD_SIGNAL_WINDOW = 9
export const SMA_WATCH_MARGIN_PCT = 2

export type SignalAction = 'BUY' | 'SELL'
export type SignalStrategy = 'SMA_CROSSOVER' | 'RSI' | 'MACD' | 'NEWS'
export type SignalStrength = 'CONFIRMED' | 'WATCH'

// Shared human-readable label, used by both the paper-trading ledger UI
// and email alert subjects so the two never drift out of sync.
export function strategyLabel(strategy: string): string {
  switch (strategy) {
    case 'SMA_CROSSOVER':
      return 'SMA crossover'
    case 'MACD':
      return 'MACD'
    case 'NEWS':
      return 'News sentiment'
    default:
      return 'RSI'
  }
}

export interface StockSignal {
  strategy: SignalStrategy
  action: SignalAction
  date: string
  index: number
  detail: string
  strength: SignalStrength
}

export interface SignalParams {
  smaShort: number
  smaLong: number
  rsiOversold: number
  rsiOverbought: number
  adxThreshold: number
}

export const DEFAULT_PARAMS: SignalParams = {
  smaShort: SMA_SHORT_WINDOW,
  smaLong: SMA_LONG_WINDOW,
  rsiOversold: RSI_OVERSOLD_THRESHOLD,
  rsiOverbought: RSI_OVERBOUGHT_THRESHOLD,
  adxThreshold: ADX_THRESHOLD,
}

export interface MACDResult {
  macdLine: (number | null)[]
  signalLine: (number | null)[]
  histogram: (number | null)[]
}

// Simple moving average, null until `window` values have accumulated -
// matches pandas' rolling(window, min_periods=window).mean() in signals.py.
export function calculateSMA(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

// Wilder RSI via an exponential moving average with alpha = 1/window
// (adjust=False), matching pandas' ewm(...).mean() in signals.py. Null until
// `window` price deltas have been observed.
export function calculateRSI(values: number[], window: number = RSI_WINDOW): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  const alpha = 1 / window
  let avgGain = 0
  let avgLoss = 0
  let deltasSeen = 0

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1]
    const gain = Math.max(delta, 0)
    const loss = Math.max(-delta, 0)

    if (deltasSeen === 0) {
      avgGain = gain
      avgLoss = loss
    } else {
      avgGain = alpha * gain + (1 - alpha) * avgGain
      avgLoss = alpha * loss + (1 - alpha) * avgLoss
    }
    deltasSeen++

    if (deltasSeen >= window) {
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    }
  }
  return out
}

// Standard EMA (alpha = 2/(window+1) - distinct from RSI/ADX's Wilder
// smoothing above, which uses alpha = 1/window). Matches pandas'
// ewm(span=window, adjust=False).mean(): the recursion itself starts at
// index 0 seeded with the first raw value, but only surfaces (non-null)
// once `window` values have been seen - the internal state still reflects
// the whole run-up, not a fresh SMA-seeded restart at that point.
export function calculateEMA(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length === 0) return out
  const alpha = 2 / (window + 1)
  let ema = values[0]
  if (window === 1) out[0] = ema
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema
    if (i >= window - 1) out[i] = ema
  }
  return out
}

export function calculateMACD(
  close: number[],
  fastWindow: number = MACD_FAST_WINDOW,
  slowWindow: number = MACD_SLOW_WINDOW,
  signalWindow: number = MACD_SIGNAL_WINDOW
): MACDResult {
  const emaFast = calculateEMA(close, fastWindow)
  const emaSlow = calculateEMA(close, slowWindow)
  const macdLine: (number | null)[] = close.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  )

  // The signal line is an EMA of the MACD line itself, but macdLine is null
  // until the slow EMA warms up - compact to the contiguous non-null tail,
  // run EMA on that, then map the result back to the original indices.
  const macdValues: number[] = []
  const macdIndices: number[] = []
  macdLine.forEach((v, i) => {
    if (v != null) {
      macdValues.push(v)
      macdIndices.push(i)
    }
  })
  const signalCompact = calculateEMA(macdValues, signalWindow)
  const signalLine: (number | null)[] = new Array(close.length).fill(null)
  signalCompact.forEach((v, j) => {
    if (v != null) signalLine[macdIndices[j]] = v
  })

  const histogram: (number | null)[] = close.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? (macdLine[i] as number) - (signalLine[i] as number) : null
  )

  return { macdLine, signalLine, histogram }
}

// Wilder's smoothing (alpha = 1/window): seeds with the first value in
// range, seeded with the plain average of the first `window` values (the
// classic Wilder convention - distinct from calculateRSI's smoothing above,
// which seeds from a single first value to match the original Python
// project's pandas ewm(adjust=False) output exactly). `skip` lets a leading
// placeholder entry (index 0 of the TR/+DM/-DM series below, which has no
// prior day to compare against) be ignored before smoothing starts.
function wilderSmooth(values: number[], window: number, skip: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  const alpha = 1 / window
  let avg = 0
  let sum = 0
  let seen = 0
  for (let i = skip; i < values.length; i++) {
    seen++
    if (seen < window) {
      sum += values[i]
      continue
    }
    avg = seen === window ? (sum + values[i]) / window : alpha * values[i] + (1 - alpha) * avg
    out[i] = avg
  }
  return out
}

// Average Directional Index - measures trend STRENGTH (not direction), used
// in computeSignals to filter out crossover signals fired during a choppy,
// non-trending market rather than as a signal of its own. Standard Wilder
// formula throughout (matches RSI's smoothing style, applied to true range
// and directional movement instead of price gain/loss).
export function calculateADX(
  high: number[],
  low: number[],
  close: number[],
  window: number = ADX_WINDOW
): (number | null)[] {
  const n = close.length
  const trValues = new Array(n).fill(0)
  const plusDMValues = new Array(n).fill(0)
  const minusDMValues = new Array(n).fill(0)

  for (let i = 1; i < n; i++) {
    const upMove = high[i] - high[i - 1]
    const downMove = low[i - 1] - low[i]
    plusDMValues[i] = upMove > downMove && upMove > 0 ? upMove : 0
    minusDMValues[i] = downMove > upMove && downMove > 0 ? downMove : 0
    trValues[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  }

  const smoothedTR = wilderSmooth(trValues, window, 1)
  const smoothedPlusDM = wilderSmooth(plusDMValues, window, 1)
  const smoothedMinusDM = wilderSmooth(minusDMValues, window, 1)

  const dx: (number | null)[] = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const tr = smoothedTR[i]
    const pDM = smoothedPlusDM[i]
    const mDM = smoothedMinusDM[i]
    if (tr == null || pDM == null || mDM == null || tr === 0) continue
    const plusDI = (100 * pDM) / tr
    const minusDI = (100 * mDM) / tr
    const sum = plusDI + minusDI
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / sum
  }

  // ADX is DX smoothed the same Wilder way, a second time - compact to the
  // dense non-null tail first (same technique as the MACD signal line).
  const dxValues: number[] = []
  const dxIndices: number[] = []
  dx.forEach((v, i) => {
    if (v != null) {
      dxValues.push(v)
      dxIndices.push(i)
    }
  })
  const adxCompact = wilderSmooth(dxValues, window, 0)
  const adx: (number | null)[] = new Array(n).fill(null)
  adxCompact.forEach((v, j) => {
    if (v != null) adx[dxIndices[j]] = v
  })

  return adx
}

export interface ComputeSignalsResult {
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  macd: MACDResult
  adx: (number | null)[]
  signals: StockSignal[]
  // Near-trigger heads-up, kept entirely separate from `signals` above -
  // never fed into reconcileTicker/reconcileAndPersist (a near-miss must
  // never open a fake paper trade) and never returned by the history route
  // (a near-miss must never render as a confirmed chart marker). Only the
  // crons consume this, for the "watch zone" alert path.
  watchSignals: StockSignal[]
}

// Scans the full series for SMA golden/death crosses, MACD-line/signal-line
// crosses, and RSI crossing INTO the oversold/overbought zone (not every day
// it stays there - a stock pinned above RSI 70 for two weeks is one signal,
// not fourteen). SMA and MACD crossovers are only emitted when ADX confirms
// a real trend at that point (default threshold 25) - a crossover during a
// sideways, choppy stretch is exactly the false-positive case ADX exists to
// catch. RSI is deliberately NOT ADX-filtered: it's a mean-reversion signal
// meant for ranging markets, the opposite regime ADX-filtering selects for.
export function computeSignals(
  dates: string[],
  close: number[],
  high: number[],
  low: number[],
  params: SignalParams = DEFAULT_PARAMS
): ComputeSignalsResult {
  const smaShort = calculateSMA(close, params.smaShort)
  const smaLong = calculateSMA(close, params.smaLong)
  const rsi = calculateRSI(close, RSI_WINDOW)
  const macd = calculateMACD(close)
  const adx = calculateADX(high, low, close, ADX_WINDOW)
  const signals: StockSignal[] = []
  const watchSignals: StockSignal[] = []

  const adxConfirmsTrend = (i: number): boolean => {
    const a = adx[i]
    return a != null && a >= params.adxThreshold
  }

  // Gap as a % of the long SMA - positive means short is above long.
  const smaGapPct = (s: number, l: number): number => ((s - l) / l) * 100

  let prevSmaDiff: number | null = null
  let prevSmaGapPct: number | null = null
  for (let i = 0; i < close.length; i++) {
    const s = smaShort[i]
    const l = smaLong[i]
    if (s == null || l == null) continue
    const diff = s - l
    const gapPct = smaGapPct(s, l)
    if (prevSmaDiff !== null && adxConfirmsTrend(i)) {
      if (prevSmaDiff <= 0 && diff > 0) {
        signals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'BUY',
          date: dates[i],
          index: i,
          detail: `Golden cross: ${params.smaShort}-day SMA (${s.toFixed(2)}) crossed above the ${params.smaLong}-day SMA (${l.toFixed(2)}); ADX ${adx[i]!.toFixed(1)} confirms a trend.`,
          strength: 'CONFIRMED',
        })
      } else if (prevSmaDiff >= 0 && diff < 0) {
        signals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'SELL',
          date: dates[i],
          index: i,
          detail: `Death cross: ${params.smaShort}-day SMA (${s.toFixed(2)}) crossed below the ${params.smaLong}-day SMA (${l.toFixed(2)}); ADX ${adx[i]!.toFixed(1)} confirms a trend.`,
          strength: 'CONFIRMED',
        })
      }
    }

    // Watch zone: the gap is closing in on a cross but hasn't happened yet
    // - fires once on entering the band, not every day it stays there. Not
    // ADX-filtered on purpose: this is meant to be an earlier heads-up than
    // the ADX-confirmed crossover above, not another trend-confirmed signal.
    if (prevSmaGapPct !== null && diff !== 0) {
      const enteringBullishWatch = gapPct > -SMA_WATCH_MARGIN_PCT && gapPct < 0 && !(prevSmaGapPct > -SMA_WATCH_MARGIN_PCT && prevSmaGapPct < 0)
      const enteringBearishWatch = gapPct > 0 && gapPct < SMA_WATCH_MARGIN_PCT && !(prevSmaGapPct > 0 && prevSmaGapPct < SMA_WATCH_MARGIN_PCT)
      if (enteringBullishWatch) {
        watchSignals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'BUY',
          date: dates[i],
          index: i,
          detail: `Approaching a golden cross: ${params.smaShort}-day SMA (${s.toFixed(2)}) is ${Math.abs(gapPct).toFixed(2)}% below the ${params.smaLong}-day SMA (${l.toFixed(2)}).`,
          strength: 'WATCH',
        })
      } else if (enteringBearishWatch) {
        watchSignals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'SELL',
          date: dates[i],
          index: i,
          detail: `Approaching a death cross: ${params.smaShort}-day SMA (${s.toFixed(2)}) is ${gapPct.toFixed(2)}% above the ${params.smaLong}-day SMA (${l.toFixed(2)}).`,
          strength: 'WATCH',
        })
      }
    }
    prevSmaDiff = diff
    prevSmaGapPct = gapPct
  }

  let prevMacdDiff: number | null = null
  for (let i = 0; i < close.length; i++) {
    const m = macd.macdLine[i]
    const sig = macd.signalLine[i]
    if (m == null || sig == null) continue
    const diff = m - sig
    if (prevMacdDiff !== null && adxConfirmsTrend(i)) {
      if (prevMacdDiff <= 0 && diff > 0) {
        signals.push({
          strategy: 'MACD',
          action: 'BUY',
          date: dates[i],
          index: i,
          detail: `MACD (${m.toFixed(2)}) crossed above its signal line (${sig.toFixed(2)}); ADX ${adx[i]!.toFixed(1)} confirms a trend.`,
          strength: 'CONFIRMED',
        })
      } else if (prevMacdDiff >= 0 && diff < 0) {
        signals.push({
          strategy: 'MACD',
          action: 'SELL',
          date: dates[i],
          index: i,
          detail: `MACD (${m.toFixed(2)}) crossed below its signal line (${sig.toFixed(2)}); ADX ${adx[i]!.toFixed(1)} confirms a trend.`,
          strength: 'CONFIRMED',
        })
      }
    }
    prevMacdDiff = diff
  }

  // Watch-zone membership just above/below the confirmed thresholds - the
  // ranges never overlap with the confirmed r <= oversold / r >= overbought
  // conditions below, so a watch and a confirmed RSI signal can never fire
  // for the same reading.
  const inBuyWatch = (v: number) => v > params.rsiOversold && v <= params.rsiOversold + RSI_WATCH_MARGIN
  const inSellWatch = (v: number) => v < params.rsiOverbought && v >= params.rsiOverbought - RSI_WATCH_MARGIN

  let prevRsi: number | null = null
  for (let i = 0; i < close.length; i++) {
    const r = rsi[i]
    if (r == null) {
      prevRsi = null
      continue
    }
    if ((prevRsi === null || prevRsi > params.rsiOversold) && r <= params.rsiOversold) {
      signals.push({
        strategy: 'RSI',
        action: 'BUY',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, at or below the oversold threshold of ${params.rsiOversold}.`,
        strength: 'CONFIRMED',
      })
    } else if ((prevRsi === null || prevRsi < params.rsiOverbought) && r >= params.rsiOverbought) {
      signals.push({
        strategy: 'RSI',
        action: 'SELL',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, at or above the overbought threshold of ${params.rsiOverbought}.`,
        strength: 'CONFIRMED',
      })
    } else if (inBuyWatch(r) && !(prevRsi !== null && inBuyWatch(prevRsi))) {
      watchSignals.push({
        strategy: 'RSI',
        action: 'BUY',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, approaching the oversold threshold of ${params.rsiOversold}.`,
        strength: 'WATCH',
      })
    } else if (inSellWatch(r) && !(prevRsi !== null && inSellWatch(prevRsi))) {
      watchSignals.push({
        strategy: 'RSI',
        action: 'SELL',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, approaching the overbought threshold of ${params.rsiOverbought}.`,
        strength: 'WATCH',
      })
    }
    prevRsi = r
  }

  signals.sort((a, b) => a.index - b.index)
  watchSignals.sort((a, b) => a.index - b.index)
  return { sma50: smaShort, sma200: smaLong, rsi, macd, adx, signals, watchSignals }
}
