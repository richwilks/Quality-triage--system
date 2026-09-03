import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cronAuth'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { reconcileAndPersist } from '@/lib/paperTrading'
import { getSignalParams } from '@/lib/paramTuning'
import { fetchNewsSignals } from '@/lib/newsSignal'

// Bumped from 60s: the per-ticker loop below is sequential, and a bigger
// watchlist (e.g. the Nasdaq-100 top 20 + QQQ bulk-add) needs more headroom.
export const maxDuration = 120

// Daily Vercel Cron job (see vercel.json) that keeps every user's paper-
// trading ledger up to date, even if nobody opens the dashboard that day.
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const supabaseAdmin = createWatchlistAdminClient()

  const { data: watchlistRows, error } = await supabaseAdmin
    .from('stock_watchlist')
    .select('user_id, ticker')

  if (error) {
    return NextResponse.json({ error: 'Could not load watchlists' }, { status: 500 })
  }

  // Group users by ticker so a ticker several users watch is only fetched
  // from Yahoo once, not once per user.
  const usersByTicker = new Map<string, string[]>()
  for (const row of watchlistRows || []) {
    const users = usersByTicker.get(row.ticker) || []
    users.push(row.user_id)
    usersByTicker.set(row.ticker, users)
  }

  const summary: { ticker: string; usersReconciled: number; opened: number; closed: number; error?: string }[] = []

  for (const [ticker, userIds] of usersByTicker) {
    const result = await fetchDailyCloses(ticker)
    if (!result.ok) {
      summary.push({ ticker, usersReconciled: 0, opened: 0, closed: 0, error: result.error })
      continue
    }

    const { dates, close, high, low, currency } = result.data
    const params = await getSignalParams(ticker)
    const { signals } = computeSignals(dates, close, high, low, params.params)
    const newsSignals = await fetchNewsSignals(supabaseAdmin, ticker, dates)
    const allSignals = [...signals, ...newsSignals].sort((a, b) => a.index - b.index)

    let opened = 0
    let closed = 0
    for (const userId of userIds) {
      const { toInsert, toClose } = await reconcileAndPersist(
        supabaseAdmin,
        userId,
        ticker,
        currency,
        allSignals,
        close
      )
      opened += toInsert.length
      closed += toClose.length
    }

    summary.push({ ticker, usersReconciled: userIds.length, opened, closed })
  }

  return NextResponse.json({ summary })
}
