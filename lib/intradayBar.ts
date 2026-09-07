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
  volume: number[]
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
    // Finnhub's free /quote endpoint has no live volume field, so today's
    // still-forming bar gets 0 (never a spike) until the real daily bar
    // lands with its actual volume, same convention fetchDailyCloses uses
    // for a missing historical entry.
    volume: [...history.volume, 0],
  }
}
