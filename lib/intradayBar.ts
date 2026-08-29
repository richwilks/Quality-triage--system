// Pure helper: appends today's still-forming bar (from Finnhub's /quote) to
// a daily close/high/low history, so computeSignals (lib/stockSignals.ts)
// can be run against "today" before the real end-of-day bar exists. Kept
// pure and separate from the fetch calls themselves so it's cheap to
// unit-test with synthetic data.

export interface DailySeries {
  dates: string[]
  close: number[]
  high: number[]
  low: number[]
}

export interface IntradayQuote {
  price: number
  high: number
  low: number
}

// Returns null when there's nothing to append - either the real daily bar
// for today has already landed (dates already ends with todayDate), or the
// history is empty.
export function appendTodayBar(history: DailySeries, todayDate: string, quote: IntradayQuote): DailySeries | null {
  if (history.dates.length === 0) return null
  if (history.dates[history.dates.length - 1] === todayDate) return null

  return {
    dates: [...history.dates, todayDate],
    close: [...history.close, quote.price],
    high: [...history.high, quote.high],
    low: [...history.low, quote.low],
  }
}
