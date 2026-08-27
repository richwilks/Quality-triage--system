'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import StockChart, { StockHistory } from '@/components/charts/StockChart'
import PaperTradingSummary from '@/components/PaperTradingSummary'

// Unlisted page: intentionally not linked from Sidebar/BottomNav/QUICK_LINKS
// while the stock signal monitor project is under development. Reachable
// only via direct URL (/dashboard/stock-monitor); still behind the normal
// auth check in middleware.ts like every other /dashboard route.

export default function StockMonitorPage() {
  const [tickers, setTickers] = useState<string[]>([])
  const [activeTicker, setActiveTicker] = useState<string | null>(null)
  const [newTicker, setNewTicker] = useState('')
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [watchlistLoading, setWatchlistLoading] = useState(true)

  const [history, setHistory] = useState<StockHistory | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadWatchlist()
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
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          {!activeTicker && <p className="text-sm text-deck-dim">Add a ticker above to see its chart.</p>}

          {activeTicker && (
            <>
              <p className="text-sm font-semibold text-deck-text">{activeTicker}</p>
              {historyLoading && <p className="mt-2 text-sm text-deck-dim">Loading chart...</p>}
              {historyError && <p className="mt-2 text-sm text-red-600">{historyError}</p>}
              {history && !historyLoading && <div className="mt-3"><StockChart history={history} /></div>}
            </>
          )}
        </div>

        <PaperTradingSummary />

        <p className="mt-4 text-xs text-deck-dim">
          Decision-support only, based on lagging technical indicators (50/200-day
          SMA crossover and 14-day RSI) — not financial advice.
        </p>
      </div>
    </div>
  )
}
