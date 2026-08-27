import { NextRequest, NextResponse } from 'next/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { computeSignals } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { reconcileAndPersist } from '@/lib/paperTrading'
import { getSignalParams } from '@/lib/paramTuning'

export const maxDuration = 60

// Daily Vercel Cron job (see vercel.json) that keeps every user's paper-
// trading ledger up to date, even if nobody opens the dashboard that day.
// Vercel auto-attaches `Authorization: Bearer ${CRON_SECRET}` to its own
// invocations when CRON_SECRET is set as a project env var - this checks
// that header so the route can't be triggered by an arbitrary public request.
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

    let opened = 0
    let closed = 0
    for (const userId of userIds) {
      const { toInsert, toClose } = await reconcileAndPersist(
        supabaseAdmin,
        userId,
        ticker,
        currency,
        signals,
        close
      )
      opened += toInsert.length
      closed += toClose.length
    }

    summary.push({ ticker, usersReconciled: userIds.length, opened, closed })
  }

  return NextResponse.json({ summary })
}
