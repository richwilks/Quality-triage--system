// TypeScript port of the SMA-crossover / RSI signal logic in
// stock-signal-monitor/signals.py, adapted to scan an entire price history
// (rather than just the latest day) so the dashboard chart can mark every
// past BUY/SELL point, not only the most recent one.

export const SMA_SHORT_WINDOW = 50
export const SMA_LONG_WINDOW = 200
export const RSI_WINDOW = 14
export const RSI_OVERSOLD_THRESHOLD = 30
export const RSI_OVERBOUGHT_THRESHOLD = 70

export type SignalAction = 'BUY' | 'SELL'
export type SignalStrategy = 'SMA_CROSSOVER' | 'RSI'

export interface StockSignal {
  strategy: SignalStrategy
  action: SignalAction
  date: string
  index: number
  detail: string
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

// Scans the full series for SMA golden/death crosses and for RSI crossing
// INTO the oversold/overbought zone (not every day it stays there - a stock
// pinned above RSI 70 for two weeks is one signal, not fourteen).
export function computeSignals(
  dates: string[],
  close: number[]
): { sma50: (number | null)[]; sma200: (number | null)[]; rsi: (number | null)[]; signals: StockSignal[] } {
  const sma50 = calculateSMA(close, SMA_SHORT_WINDOW)
  const sma200 = calculateSMA(close, SMA_LONG_WINDOW)
  const rsi = calculateRSI(close, RSI_WINDOW)
  const signals: StockSignal[] = []

  let prevDiff: number | null = null
  for (let i = 0; i < close.length; i++) {
    const s = sma50[i]
    const l = sma200[i]
    if (s == null || l == null) continue
    const diff = s - l
    if (prevDiff !== null) {
      if (prevDiff <= 0 && diff > 0) {
        signals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'BUY',
          date: dates[i],
          index: i,
          detail: `Golden cross: 50-day SMA (${s.toFixed(2)}) crossed above the 200-day SMA (${l.toFixed(2)}).`,
        })
      } else if (prevDiff >= 0 && diff < 0) {
        signals.push({
          strategy: 'SMA_CROSSOVER',
          action: 'SELL',
          date: dates[i],
          index: i,
          detail: `Death cross: 50-day SMA (${s.toFixed(2)}) crossed below the 200-day SMA (${l.toFixed(2)}).`,
        })
      }
    }
    prevDiff = diff
  }

  let prevRsi: number | null = null
  for (let i = 0; i < close.length; i++) {
    const r = rsi[i]
    if (r == null) {
      prevRsi = null
      continue
    }
    if ((prevRsi === null || prevRsi > RSI_OVERSOLD_THRESHOLD) && r <= RSI_OVERSOLD_THRESHOLD) {
      signals.push({
        strategy: 'RSI',
        action: 'BUY',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, at or below the oversold threshold of ${RSI_OVERSOLD_THRESHOLD}.`,
      })
    } else if ((prevRsi === null || prevRsi < RSI_OVERBOUGHT_THRESHOLD) && r >= RSI_OVERBOUGHT_THRESHOLD) {
      signals.push({
        strategy: 'RSI',
        action: 'SELL',
        date: dates[i],
        index: i,
        detail: `RSI(14) = ${r.toFixed(1)}, at or above the overbought threshold of ${RSI_OVERBOUGHT_THRESHOLD}.`,
      })
    }
    prevRsi = r
  }

  signals.sort((a, b) => a.index - b.index)
  return { sma50, sma200, rsi, signals }
}
