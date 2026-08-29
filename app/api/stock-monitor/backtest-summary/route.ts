import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { getSignalParams } from '@/lib/paramTuning'
import { reconcileTicker } from '@/lib/paperTrading'
import { summarizeBacktest } from '@/lib/backtestSummary'

// "What if I'd invested INVESTED_AMOUNT on every BUY and sold in full on
// every SELL" - a standalone historical simulation, separate from the live
// paper_trades ledger. Reuses the exact same signal computation and trade-
// pairing logic that ledger already runs (computeSignals, reconcileTicker),
// just replayed from scratch over a longer history with no prior state, so
// the answer is consistent with what the dashboard already shows for new
// signals. Technical strategies only (SMA crossover, MACD, RSI) - the NEWS
// strategy can't be reconstructed this far back since sentiment data has
// only been collected since that feature launched.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const monthsParam = Number(req.nextUrl.searchParams.get('months'))
  const months = Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 48) : 18

  const windowStart = new Date()
  windowStart.setMonth(windowStart.getMonth() - months)
  const windowStartDate = windowStart.toISOString().slice(0, 10)

  const watchlistDb = createWatchlistAdminClient()
  const { data: watchlistRows } = await watchlistDb.from('stock_watchlist').select('ticker').eq('user_id', user.id)
  const tickers = (watchlistRows || []).map((r) => r.ticker)

  const perTicker: {
    ticker: string
    currency: string
    trades: number
    invested: number
    pnl: number
    returnPct: number | null
    stillOpen: boolean
    error?: string
  }[] = []

  for (const ticker of tickers) {
    // 5y gives ample warm-up room ahead of the requested window so
    // SMA200/RSI/MACD/ADX aren't cold-starting right at the window
    // boundary, for any lookback up to the 48-month cap above.
    const historyResult = await fetchDailyCloses(ticker, '5y')
    if (!historyResult.ok) {
      perTicker.push({ ticker, currency: '', trades: 0, invested: 0, pnl: 0, returnPct: null, stillOpen: false, error: historyResult.error })
      continue
    }

    const { dates, close, high, low, currency } = historyResult.data
    const params = await getSignalParams(ticker)
    const { signals } = computeSignals(dates, close, high, low, params.params)
    const { toInsert, toClose } = reconcileTicker(ticker, currency, null, null, signals, close)
    const summary = summarizeBacktest(toInsert, toClose, windowStartDate)

    perTicker.push({ ticker, currency, ...summary })
  }

  const totalsByCurrency: Record<string, { invested: number; pnl: number }> = {}
  for (const t of perTicker) {
    if (!t.currency || t.trades === 0) continue
    const bucket = totalsByCurrency[t.currency] || { invested: 0, pnl: 0 }
    bucket.invested += t.invested
    bucket.pnl += t.pnl
    totalsByCurrency[t.currency] = bucket
  }

  return NextResponse.json({ months, windowStart: windowStartDate, perTicker, totalsByCurrency })
}
