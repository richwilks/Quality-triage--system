// Free, no-key daily-history fetch - the same public Yahoo Finance chart API
// that the yfinance library (used by stock-signal-monitor/data_fetcher.py)
// wraps under the hood. Shared by the history route, the paper-trades read
// route, and the daily backtest cron.

export type DailyCloses = {
  dates: string[]
  close: number[]
  high: number[]
  low: number[]
  currency: string
}

export type FetchDailyClosesResult =
  | { ok: true; data: DailyCloses }
  | { ok: false; status: number; error: string }

function yahooChartUrl(ticker: string, range: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`
}

export async function fetchDailyCloses(ticker: string, range: string = '1y'): Promise<FetchDailyClosesResult> {
  let json: any
  try {
    const res = await fetch(yahooChartUrl(ticker, range), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 }, // 15 min, matching the monitor's check interval
    })
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)
    json = await res.json()
  } catch {
    return { ok: false, status: 502, error: `Could not fetch price data for ${ticker}` }
  }

  const result = json?.chart?.result?.[0]
  const timestamps: number[] | undefined = result?.timestamp
  const quote = result?.indicators?.quote?.[0]
  const closes: (number | null)[] | undefined = quote?.close
  const highs: (number | null)[] | undefined = quote?.high
  const lows: (number | null)[] | undefined = quote?.low
  const currency: string = result?.meta?.currency || 'USD'

  if (!timestamps || !closes || timestamps.length === 0) {
    return { ok: false, status: 404, error: `No price data found for ${ticker}` }
  }

  // Drop any bars with a null close (holidays/gaps in the raw feed). A
  // missing high/low on an otherwise-valid bar falls back to that day's
  // close, so downstream indicators never see a hole mid-series.
  const dates: string[] = []
  const close: number[] = []
  const high: number[] = []
  const low: number[] = []
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10))
    close.push(closes[i] as number)
    high.push(highs?.[i] ?? (closes[i] as number))
    low.push(lows?.[i] ?? (closes[i] as number))
  }

  return { ok: true, data: { dates, close, high, low, currency } }
}
