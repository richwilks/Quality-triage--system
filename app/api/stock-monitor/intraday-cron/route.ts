import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cronAuth'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { computeSignals, computeConfidenceScores } from '@/lib/stockSignals'
import { fetchDailyCloses } from '@/lib/yahooFinance'
import { fetchQuote } from '@/lib/finnhub'
import { appendTodayBar } from '@/lib/intradayBar'
import { reconcileAndPersist } from '@/lib/paperTrading'
import { getSignalParams } from '@/lib/paramTuning'
import { fetchNewsSignals } from '@/lib/newsSignal'
import { notifyReconcileResult, notifyWatchSignals, notifyConfidenceScores } from '@/lib/signalAlerts'
import { fetchRecentHeadlines, formatNewsSnippet } from '@/lib/newsContext'

// Bumped from 60s: the per-ticker loop below is sequential, and a bigger
// watchlist (e.g. the Nasdaq-100 top 20 + QQQ bulk-add) needs more headroom.
export const maxDuration = 120

// Intraday companion to backtest-cron (see vercel.json for the schedule -
// every 15 minutes, 07:00-21:00 UTC, wide enough to cover both the LSE's
// session (07:00/08:00-15:30/16:30 UTC across BST/GMT, for .L tickers) and
// the US market's (13:30/14:30-20:00/21:00 UTC across EDT/EST). Where
// backtest-cron reconciles once a day off the
// real closing price, this appends today's still-forming bar (from
// Finnhub's free /quote endpoint) onto the daily history and runs the same
// reconcileAndPersist used there - so a signal gets caught, recorded in
// the paper-trading ledger, and alerted on as soon as it fires, not only
// after the close. reconcileAndPersist's existing cutoffDate logic makes
// running this every 15 minutes (and backtest-cron afterwards) safe for
// the paper-trading ledger: a signal already recorded for a ticker is
// never reprocessed. Signals fed into it are also explicitly restricted
// to today's bar (see `todaySignals` below) so the ledger only ever
// grows one live day at a time, never replaying a ticker's whole fetched
// history into it at once. Watch-zone and confidence-score alerts have no
// ledger to derive a cutoff from at all, so they get the same today-only
// restriction for their own sake, further down.
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const supabaseAdmin = createWatchlistAdminClient()

  const { data: watchlistRows, error } = await supabaseAdmin
    .from('stock_watchlist')
    .select('user_id, ticker, confidence_mode')

  if (error) {
    return NextResponse.json({ error: 'Could not load watchlists' }, { status: 500 })
  }

  const usersByTicker = new Map<string, string[]>()
  // Confidence mode is per (user, ticker) - your NVDA can be in combined-
  // score mode while someone else's NVDA still gets per-indicator alerts.
  const confidenceModeUsers = new Set<string>()
  for (const row of watchlistRows || []) {
    const users = usersByTicker.get(row.ticker) || []
    users.push(row.user_id)
    usersByTicker.set(row.ticker, users)
    if (row.confidence_mode) confidenceModeUsers.add(`${row.ticker}|${row.user_id}`)
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

    const { dates, close, high, low, volume } = extended
    const params = await getSignalParams(ticker)
    const { signals, watchSignals, bollingerSignals, volumeSpikes } = computeSignals(dates, close, high, low, params.params, volume)
    const newsSignals = await fetchNewsSignals(supabaseAdmin, ticker, dates)
    const allSignals = [...signals, ...newsSignals].sort((a, b) => a.index - b.index)
    // Paper trading only ever opens/closes a position off a signal dated
    // today - never the whole fetched year of history. Without this, a
    // ticker with an empty ledger (brand new, or catching up after a
    // stretch of cron failures) would replay every historical signal at
    // once, same backlog-flood failure mode the alert restriction below
    // guards against, just landing in the ledger instead of a
    // notification.
    const todaySignals = allSignals.filter((s) => s.date === todayDate)
    // Confidence scoring only ever draws on the confirmed technical
    // signals (not NEWS - the ask lists SMA/RSI/MACD/Bollinger) - paper
    // trading above still reconciles off todaySignals (news included)
    // exactly as it always has, regardless of anyone's confidence_mode.
    const confidenceScores = computeConfidenceScores([...signals, ...bollingerSignals], volumeSpikes)

    // watchSignals and confidenceScores are computed by scanning the
    // *entire* fetched year of history (needed for the indicators' own
    // warm-up), same as `signals` above. signal_log's unique constraint
    // already guards against re-alerting on an old, already-inserted
    // watch-zone entry, but on a ticker's very first successful run - or
    // after any stretch where the cron was silently failing, as happened
    // here - signal_log has no record of any of it yet, so every
    // historical watch-zone crossing across the whole fetched year would
    // otherwise look "new" and fire at once. Restricting to today's bar is
    // what actually keeps this "only alert on what's happening now."
    const todayWatchSignals = watchSignals.filter((s) => s.date === todayDate)
    const todayConfidenceScores = confidenceScores.filter((s) => s.date === todayDate)

    // Fetched at most once per ticker per run, and only when there's
    // actually something to report - not on every run regardless, to keep
    // Finnhub usage bounded.
    let newsSnippet: string | null = null
    let newsSnippetFetched = false
    async function getNewsSnippet(): Promise<string | null> {
      if (!newsSnippetFetched) {
        newsSnippetFetched = true
        const headlinesResult = await fetchRecentHeadlines(ticker)
        if (headlinesResult.ok) newsSnippet = formatNewsSnippet(headlinesResult.data)
      }
      return newsSnippet
    }
    if (todayWatchSignals.length > 0 || todayConfidenceScores.length > 0) await getNewsSnippet()

    let opened = 0
    let closed = 0
    const confidenceModeUserIds: string[] = []
    for (const userId of userIds) {
      const result = await reconcileAndPersist(supabaseAdmin, userId, ticker, currency, todaySignals, close)
      opened += result.toInsert.length
      closed += result.toClose.length
      // Confidence mode replaces this user's per-indicator alerts on this
      // ticker with the combined-score notification below, per the ask -
      // reconcileAndPersist above (and the paper-trading ledger it drives)
      // is unaffected either way.
      if (confidenceModeUsers.has(`${ticker}|${userId}`)) {
        confidenceModeUserIds.push(userId)
        continue
      }
      const snippet = result.toInsert.length > 0 || result.toClose.length > 0 ? await getNewsSnippet() : null
      await notifyReconcileResult(supabaseAdmin, userId, ticker, currency, result, snippet)
    }

    await notifyWatchSignals(supabaseAdmin, ticker, currency, todayWatchSignals, close, userIds, newsSnippet)
    await notifyConfidenceScores(supabaseAdmin, ticker, currency, todayConfidenceScores, close, confidenceModeUserIds, newsSnippet)

    summary.push({ ticker, usersReconciled: userIds.length, opened, closed })
  }

  return NextResponse.json({ summary })
}
