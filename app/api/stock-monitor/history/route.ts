import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSignals } from '@/lib/stockSignals'

export const maxDuration = 20

const TICKER_PATTERN = /^[A-Z0-9.-]{1,10}$/

// Free, no-key daily-history endpoint - the same public Yahoo Finance chart
// API that the yfinance library (used by stock-signal-monitor/data_fetcher.py)
// wraps under the hood.
function yahooChartUrl(ticker: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') || '').toUpperCase().trim()
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  let json: any
  try {
    const res = await fetch(yahooChartUrl(ticker), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 }, // 15 min, matching the monitor's check interval
    })
    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)
    json = await res.json()
  } catch {
    return NextResponse.json({ error: `Could not fetch price data for ${ticker}` }, { status: 502 })
  }

  const result = json?.chart?.result?.[0]
  const timestamps: number[] | undefined = result?.timestamp
  const closes: (number | null)[] | undefined = result?.indicators?.quote?.[0]?.close

  if (!timestamps || !closes || timestamps.length === 0) {
    return NextResponse.json({ error: `No price data found for ${ticker}` }, { status: 404 })
  }

  // Drop any bars with a null close (holidays/gaps in the raw feed).
  const dates: string[] = []
  const close: number[] = []
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10))
    close.push(closes[i] as number)
  }

  const { sma50, sma200, rsi, signals } = computeSignals(dates, close)

  return NextResponse.json({ ticker, dates, close, sma50, sma200, rsi, signals })
}
