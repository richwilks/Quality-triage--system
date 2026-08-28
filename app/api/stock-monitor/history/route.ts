import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { getSignalParams } from '@/lib/paramTuning'
import { fetchNewsSignals } from '@/lib/newsSignal'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

export const maxDuration = 20

const TICKER_PATTERN = /^[A-Z0-9.-]{1,10}$/

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

  const result = await fetchDailyCloses(ticker)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { dates, close, high, low, currency } = result.data
  const params = await getSignalParams(ticker)
  const { sma50, sma200, rsi, macd, adx, signals } = computeSignals(dates, close, high, low, params.params)

  const newsSignals = await fetchNewsSignals(createWatchlistAdminClient(), ticker, dates)
  const allSignals = [...signals, ...newsSignals].sort((a, b) => a.index - b.index)

  return NextResponse.json({
    ticker,
    currency,
    dates,
    close,
    sma50,
    sma200,
    rsi,
    macd,
    adx,
    signals: allSignals,
    smaShortWindow: params.params.smaShort,
    smaLongWindow: params.params.smaLong,
    tuned: params.tuned,
    tunedAt: params.tunedAt ?? null,
    backtestReturnPct: params.backtestReturnPct ?? null,
    validatedReturnPct: params.validatedReturnPct ?? null,
  })
}
