import { NextRequest, NextResponse } from 'next/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { fetchQuote } from '@/lib/finnhub'
import { appendTodayBar } from '@/lib/intradayBar'
import { reconcileAndPersist } from '@/lib/paperTrading'
import { getSignalParams } from '@/lib/paramTuning'
import { fetchNewsSignals } from '@/lib/newsSignal'
import { notifyReconcileResult } from '@/lib/signalAlerts'

// Bumped from 60s: the per-ticker loop below is sequential, and a bigger
// watchlist (e.g. the Nasdaq-100 top 20 + QQQ bulk-add) needs more headroom.
export const maxDuration = 120

// Intraday companion to backtest-cron (see vercel.json for the schedule -
// every 15 minutes during a window wide enough to cover US market hours
// across both EST/EDT). Where backtest-cron reconciles once a day off the
// real closing price, this appends today's still-forming bar (from
// Finnhub's free /quote endpoint) onto the daily history and runs the same
// reconcileAndPersist used there - so a signal gets caught, recorded in
// the paper-trading ledger, and alerted on as soon as it fires, not only
// after the close. reconcileAndPersist's existing cutoffDate logic makes
// running this every 15 minutes (and backtest-cron afterwards) safe: a
// signal already recorded for today is never reprocessed.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createWatchlistAdminClient()

  const { data: watchlistRows, error } = await supabaseAdmin
    .from('stock_watchlist')
    .select('user_id, ticker')

  if (error) {
    return NextResponse.json({ error: 'Could not load watchlists' }, { status: 500 })
  }

  const usersByTicker = new Map<string, string[]>()
  for (const row of watchlistRows || []) {
    const users = usersByTicker.get(row.ticker) || []
    users.push(row.user_id)
    usersByTicker.set(row.ticker, users)
  }

  const todayDate = new Date().toISOString().slice(0, 10)
  const summary: { ticker: string; usersReconciled: number; opened: number; closed: number; skipped?: string; error?: string }[] = []

  for (const [ticker, userIds] of usersByTicker) {
    const historyResult = await fetchDailyCloses(ticker)
    if (!historyResult.ok) {
      summary.push({ ticker, usersReconciled: 0, opened: 0, closed: 0, error: historyResult.error })
      continue
    }

    const quoteResult = await fetchQuote(ticker)
    if (!quoteResult.ok) {
      summary.push({ ticker, usersReconciled: 0, opened: 0, closed: 0, error: quoteResult.error })
      continue
    }

    const { currency } = historyResult.data
    const extended = appendTodayBar(historyResult.data, todayDate, quoteResult.data)
    if (!extended) {
      summary.push({ ticker, usersReconciled: 0, opened: 0, closed: 0, skipped: "today's bar already present" })
      continue
    }

    const { dates, close, high, low } = extended
    const params = await getSignalParams(ticker)
    const { signals } = computeSignals(dates, close, high, low, params.params)
    const newsSignals = await fetchNewsSignals(supabaseAdmin, ticker, dates)
    const allSignals = [...signals, ...newsSignals].sort((a, b) => a.index - b.index)

    let opened = 0
    let closed = 0
    for (const userId of userIds) {
      const result = await reconcileAndPersist(supabaseAdmin, userId, ticker, currency, allSignals, close)
      opened += result.toInsert.length
      closed += result.toClose.length
      await notifyReconcileResult(supabaseAdmin, userId, ticker, currency, result)
    }

    summary.push({ ticker, usersReconciled: userIds.length, opened, closed })
  }

  return NextResponse.json({ summary })
}
