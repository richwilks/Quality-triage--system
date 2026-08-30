'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import StockChart, { StockHistory } from '@/components/charts/StockChart'
import PaperTradingSummary from '@/components/PaperTradingSummary'
import NewsFeed from '@/components/NewsFeed'
import RecentTriggers from '@/components/RecentTriggers'
import { NASDAQ100_TOP20_PLUS_QQQ, FTSE100_TOP20 } from '@/lib/watchlistPresets'

// The stock signal monitor's actual page body, shared by two routes:
// /dashboard/stock-monitor (original) and /stock-monitoring (top-level, so
// it can be pinned to a home-screen icon with its own manifest/start_url -
// see app/stock-monitoring/layout.tsx for why that needs to be a separate
// route rather than just a link). Neither route is linked from
// Sidebar/BottomNav/QUICK_LINKS while this is under development; both are
// still behind the normal auth check in middleware.ts like every other page.

type HistoryWithTuning = StockHistory & {
  tuned: boolean
  tunedAt: string | null
  backtestReturnPct: number | null
  validatedReturnPct: number | null
}

export default function StockMonitorDashboard() {
  const [tickers, setTickers] = useState<string[]>([])
  const [activeTicker, setActiveTicker] = useState<string | null>(null)
  const [newTicker, setNewTicker] = useState('')
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [watchlistLoading, setWatchlistLoading] = useState(true)
  const [bulkAddLoading, setBulkAddLoading] = useState(false)
  const [bulkAddMessage, setBulkAddMessage] = useState<string | null>(null)

  const [history, setHistory] = useState<HistoryWithTuning | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [alertEmail, setAlertEmail] = useState('')
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [alertsMessage, setAlertsMessage] = useState<string | null>(null)

  useEffect(() => {
    loadWatchlist()
    loadAlertSettings()
  }, [])

  useEffect(() => {
    if (activeTicker) loadHistory(activeTicker)
  }, [activeTicker])

  async function loadWatchlist() {
    setWatchlistLoading(true)
    setWatchlistError(null)
    try {
      const res = await fetch('/api/stock-monitor/watchlist')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load watchlist')
      setTickers(body.tickers)
      setActiveTicker((prev) => prev && body.tickers.includes(prev) ? prev : body.tickers[0] ?? null)
    } catch (err: any) {
      setWatchlistError(err.message || 'Could not load watchlist')
    } finally {
      setWatchlistLoading(false)
    }
  }

  async function loadHistory(ticker: string) {
    setHistoryLoading(true)
    setHistoryError(null)
    setHistory(null)
    try {
      const res = await fetch(`/api/stock-monitor/history?ticker=${encodeURIComponent(ticker)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Could not load data for ${ticker}`)
      setHistory(body)
    } catch (err: any) {
      setHistoryError(err.message || `Could not load data for ${ticker}`)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleAddTicker(e: React.FormEvent) {
    e.preventDefault()
    const ticker = newTicker.toUpperCase().trim()
    if (!ticker) return
    setWatchlistError(null)
    try {
      const res = await fetch('/api/stock-monitor/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not add ticker')
      setNewTicker('')
      setActiveTicker(ticker)
      await loadWatchlist()
    } catch (err: any) {
      setWatchlistError(err.message || 'Could not add ticker')
    }
  }

  // Adds each preset ticker via the same single-ticker endpoint the manual
  // "Add" form uses - that route already treats "already on the list" as a
  // no-op (unique_violation is swallowed), so this is safe to click more
  // than once. Sequential rather than parallel to stay well under Finnhub's
  // free-tier rate limit once the hourly news-cron starts covering these.
  async function handleBulkAdd(tickerList: string[], label: string) {
    setBulkAddLoading(true)
    setBulkAddMessage(null)
    setWatchlistError(null)
    let added = 0
    let failed = 0
    for (const ticker of tickerList) {
      try {
        const res = await fetch('/api/stock-monitor/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        })
        if (res.ok) added += 1
        else failed += 1
      } catch {
        failed += 1
      }
    }
    await loadWatchlist()
    setBulkAddLoading(false)
    setBulkAddMessage(
      failed === 0
        ? `Added ${label} (${added} tickers, already-listed ones skipped).`
        : `Added ${label}: ${added} succeeded, ${failed} failed - try again for the failed ones.`
    )
  }

  async function loadAlertSettings() {
    setAlertsLoading(true)
    try {
      const res = await fetch('/api/stock-monitor/notification-settings')
      const body = await res.json()
      if (res.ok) {
        setAlertEmail(body.email)
        setAlertEmailEnabled(body.emailEnabled)
        setPushEnabled(body.pushEnabled)
      }
    } finally {
      setAlertsLoading(false)
    }
  }

  async function handleSaveAlertSettings(e: React.FormEvent) {
    e.preventDefault()
    setAlertsError(null)
    setAlertsMessage(null)
    try {
      const res = await fetch('/api/stock-monitor/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: alertEmail, emailEnabled: alertEmailEnabled }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not save alert settings')
      setAlertsMessage('Saved.')
    } catch (err: any) {
      setAlertsError(err.message || 'Could not save alert settings')
    }
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  async function handleEnablePush() {
    setAlertsError(null)
    setAlertsMessage(null)
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser')
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('Push notifications are not configured yet')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Notification permission was not granted')

      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      const res = await fetch('/api/stock-monitor/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) throw new Error('Could not save push subscription')
      setPushEnabled(true)
      setAlertsMessage('Push notifications enabled on this device.')
    } catch (err: any) {
      setAlertsError(err.message || 'Could not enable push notifications')
    }
  }

  async function handleDisablePush() {
    setAlertsError(null)
    setAlertsMessage(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch(`/api/stock-monitor/push-subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        })
        await subscription.unsubscribe()
      }
      setPushEnabled(false)
      setAlertsMessage('Push notifications disabled on this device.')
    } catch (err: any) {
      setAlertsError(err.message || 'Could not disable push notifications')
    }
  }

  async function handleRemoveTicker(ticker: string) {
    setWatchlistError(null)
    try {
      const res = await fetch(`/api/stock-monitor/watchlist?ticker=${encodeURIComponent(ticker)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Could not remove ticker')
      }
      await loadWatchlist()
    } catch (err: any) {
      setWatchlistError(err.message || 'Could not remove ticker')
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Stock Signal Monitor" />

        <span className="mt-2 inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          In development
        </span>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Watchlist</p>

          {watchlistLoading ? (
            <p className="mt-2 text-sm text-deck-dim">Loading...</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {tickers.map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => setActiveTicker(ticker)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ${
                    activeTicker === ticker
                      ? 'bg-deck-accent text-white'
                      : 'bg-deck-raised text-deck-text hover:bg-deck-border'
                  }`}
                >
                  {ticker}
                  <span
                    role="button"
                    aria-label={`Remove ${ticker}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveTicker(ticker)
                    }}
                    className="rounded-full px-1 text-xs opacity-70 hover:opacity-100"
                  >
                    ×
                  </span>
                </button>
              ))}
              {tickers.length === 0 && <p className="text-sm text-deck-dim">No tickers yet - add one below.</p>}
            </div>
          )}

          <form onSubmit={handleAddTicker} className="mt-4 flex gap-2">
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="Add ticker (e.g. AAPL)"
              maxLength={10}
              className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm uppercase bg-deck-surface text-deck-text placeholder:text-deck-mute placeholder:normal-case"
            />
            <button
              type="submit"
              className="rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={!newTicker.trim()}
            >
              Add
            </button>
          </form>
          {watchlistError && <p className="mt-2 text-sm text-red-600">{watchlistError}</p>}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-deck-border pt-4">
            <button
              onClick={() => handleBulkAdd(NASDAQ100_TOP20_PLUS_QQQ, 'Nasdaq-100 top 20 + QQQ')}
              disabled={bulkAddLoading}
              className="rounded-md bg-deck-raised px-3 py-2 text-sm font-medium text-deck-text hover:bg-deck-border disabled:opacity-50"
            >
              {bulkAddLoading ? 'Adding...' : 'Add Nasdaq-100 top 20 + QQQ'}
            </button>
            <button
              onClick={() => handleBulkAdd(FTSE100_TOP20, 'FTSE 100 top 20')}
              disabled={bulkAddLoading}
              className="rounded-md bg-deck-raised px-3 py-2 text-sm font-medium text-deck-text hover:bg-deck-border disabled:opacity-50"
            >
              {bulkAddLoading ? 'Adding...' : 'Add FTSE 100 top 20'}
            </button>
          </div>
          <p className="mt-1 text-xs text-deck-dim">
            The 20 largest companies by market cap in each index (from general knowledge, not a live-verified
            current ranking) - the Nasdaq-100 list also includes QQQ, the ETF that tracks it.
          </p>
          {bulkAddMessage && <p className="mt-1 text-xs text-deck-dim">{bulkAddMessage}</p>}
        </div>

        <RecentTriggers />

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          {!activeTicker && <p className="text-sm text-deck-dim">Add a ticker above to see its chart.</p>}

          {activeTicker && (
            <>
              <p className="text-sm font-semibold text-deck-text">{activeTicker}</p>
              {historyLoading && <p className="mt-2 text-sm text-deck-dim">Loading chart...</p>}
              {historyError && <p className="mt-2 text-sm text-red-600">{historyError}</p>}
              {history && !historyLoading && (
                <div className="mt-3">
                  <StockChart history={history} />
                  {history.tuned ? (
                    <p className="mt-2 text-xs text-deck-dim">
                      Using tuned parameters (last tuned{' '}
                      {history.tunedAt ? new Date(history.tunedAt).toLocaleDateString() : 'recently'}) — backtested{' '}
                      {history.backtestReturnPct?.toFixed(1)}%, validated {history.validatedReturnPct?.toFixed(1)}% on
                      held-out data the tuning never saw.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-deck-dim">Using default parameters (not yet tuned for this ticker).</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Which signal to trust</p>
          <p className="mt-1 text-sm text-deck-text">
            SMA crossover and MACD only fire when ADX confirms a real trend - RSI deliberately doesn&apos;t use that
            filter, since it&apos;s a mean-reversion signal built for choppy, range-bound conditions instead.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-deck-text">
            <li>
              <strong>Trending market</strong> (SMA/MACD have fired): trust MACD for early timing, SMA crossover for
              slower but higher-conviction confirmation - and discount RSI, since it can stay &quot;overbought&quot;
              or &quot;oversold&quot; for a long stretch during a strong trend.
            </li>
            <li>
              <strong>Flat/ranging market</strong> (no SMA/MACD signal - ADX is low): RSI is the one actually built
              for this condition, not irrelevant.
            </li>
            <li>News sentiment is the newest, least-proven signal here - weight it lowest in any conflict.</li>
          </ul>
        </div>

        {activeTicker && <NewsFeed ticker={activeTicker} />}

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Alerts</p>
          <p className="mt-1 text-xs text-deck-dim">
            Get emailed or pushed to this device the moment a BUY/SELL signal fires - based on an intraday,
            still-forming price that can occasionally reverse by market close. That reversal still gets recorded
            in the ledger below, not hidden - it's part of tracking how accurate the signals really are.
          </p>
          <p className="mt-1 text-xs text-deck-dim">
            <strong>Confirmed</strong> alerts mean a signal actually fired and (for technical signals) opened or
            closed a position in the ledger. <strong>Watch</strong> alerts are an earlier heads-up - RSI closing in
            on its threshold, or the 50/200-day SMAs converging toward a cross - before anything is confirmed;
            they never affect the ledger, and recent news headlines are attached when available for context.
          </p>

          {alertsLoading ? (
            <p className="mt-3 text-sm text-deck-dim">Loading...</p>
          ) : (
            <>
              <form onSubmit={handleSaveAlertSettings} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                />
                <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-deck-text">
                  <input
                    type="checkbox"
                    checked={alertEmailEnabled}
                    onChange={(e) => setAlertEmailEnabled(e.target.checked)}
                  />
                  Email me
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-white"
                >
                  Save
                </button>
              </form>

              <div className="mt-3">
                <button
                  onClick={pushEnabled ? handleDisablePush : handleEnablePush}
                  className="rounded-md bg-deck-raised px-3 py-2 text-sm font-medium text-deck-text hover:bg-deck-border"
                >
                  {pushEnabled ? 'Disable push on this device' : 'Enable push on this device'}
                </button>
              </div>

              <p className="mt-2 text-xs text-deck-dim">
                On iPhone: add this page to your Home Screen first (Share → Add to Home Screen), then open it from
                there before tapping Enable - Safari tabs can't receive push notifications directly.
              </p>

              {alertsError && <p className="mt-2 text-sm text-red-600">{alertsError}</p>}
              {alertsMessage && <p className="mt-2 text-sm text-emerald-700">{alertsMessage}</p>}
            </>
          )}
        </div>

        <PaperTradingSummary />

        <Link
          href="/dashboard/stock-monitor/backtest"
          className="mt-6 flex items-center justify-between rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm hover:bg-deck-raised"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">What if?</p>
            <p className="mt-1 text-sm text-deck-text">
              See what a flat stake on every BUY/SELL signal would have returned, and what running the AI costs
            </p>
          </div>
          <span className="text-deck-dim">→</span>
        </Link>

        <p className="mt-4 text-xs text-deck-dim">
          Decision-support only, based on lagging technical indicators (SMA
          crossover, MACD, RSI, filtered by ADX trend strength) plus an
          experimental LLM-scored news-sentiment signal — not financial
          advice.
        </p>
      </div>
    </div>
  )
}
