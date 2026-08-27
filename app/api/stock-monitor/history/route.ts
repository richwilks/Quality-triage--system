import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'

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

  const { dates, close, currency } = result.data
  const { sma50, sma200, rsi, signals } = computeSignals(dates, close)

  return NextResponse.json({ ticker, currency, dates, close, sma50, sma200, rsi, signals })
}
