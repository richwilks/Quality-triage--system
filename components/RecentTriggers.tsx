'use client'

import { useEffect, useState } from 'react'
import { strategyLabel } from '@/lib/stockSignals'

type Trigger = {
  ticker: string
  signal_date: string
  strategy: string
  action: 'BUY' | 'SELL'
  signal_strength: 'watch' | 'confirmed'
  detail: string
  created_at: string
}

function niceDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function niceDate(isoDate: string): string {
  // Parsed as a plain date (no time component), so it's not shifted a day
  // by the viewer's timezone the way `new Date(isoDate)` alone can be.
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type ActionFilter = 'ALL' | 'BUY' | 'SELL'

// Cross-ticker summary of the most recent signal_log rows for the whole
// watchlist, so a fired signal is visible here without opening that
// ticker's chart individually.
// Matches how the crons compute `todayDate` server-side (UTC, not the
// viewer's local date) - so "for Jul 30" only shows up when a signal
// genuinely isn't about today, never as a timezone artifact.
const todayIso = new Date().toISOString().slice(0, 10)

export default function RecentTriggers() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load(actionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter])

  async function load(filter: ActionFilter) {
    setLoading(true)
    setError(null)
    try {
      const query = filter === 'ALL' ? '' : `?action=${filter}`
      const res = await fetch(`/api/stock-monitor/recent-triggers${query}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load recent triggers')
      setTriggers(body.triggers)
    } catch (err: any) {
      setError(err.message || 'Could not load recent triggers')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Recent triggers</p>
        <div className="flex gap-1.5">
          {(['ALL', 'BUY', 'SELL'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActionFilter(option)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                actionFilter === option
                  ? 'bg-deck-accent text-white'
                  : 'border border-deck-border text-deck-body hover:bg-deck-raised'
              }`}
            >
              {option === 'ALL' ? 'All' : option === 'BUY' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-deck-dim">
        The last 10 {actionFilter === 'ALL' ? 'signals' : `${actionFilter === 'BUY' ? 'buy' : 'sell'} signals`} across
        your whole watchlist, newest first - both watch and confirmed.
      </p>

      {loading && <p className="mt-3 text-sm text-deck-dim">Loading...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!loading && !error && triggers.length === 0 && (
        <p className="mt-3 text-sm text-deck-dim">
          {actionFilter === 'ALL'
            ? 'No signals recorded yet - this fills in as the intraday check runs.'
            : `No ${actionFilter === 'BUY' ? 'buy' : 'sell'} signals recorded yet.`}
        </p>
      )}

      {!loading && !error && triggers.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-deck-dim">
                <th className="py-1 pr-3 font-medium">When</th>
                <th className="py-1 pr-3 font-medium">Ticker</th>
                <th className="py-1 pr-3 font-medium">Action</th>
                <th className="py-1 pr-3 font-medium">Strategy</th>
                <th className="py-1 pr-3 font-medium">Type</th>
                <th className="py-1 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t, idx) => (
                <tr key={idx} className="border-t border-deck-border">
                  <td className="py-1.5 pr-3 text-deck-body">
                    {niceDateTime(t.created_at)}
                    {t.signal_date !== todayIso && (
                      <span className="block text-deck-dim" title="The trading day this signal is actually about">
                        for {niceDate(t.signal_date)}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 font-semibold text-deck-text">{t.ticker}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${t.action === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {t.action}
                  </td>
                  <td className="py-1.5 pr-3 text-deck-body">{strategyLabel(t.strategy)}</td>
                  <td className="py-1.5 pr-3 text-deck-body">{t.signal_strength === 'watch' ? 'Watch' : 'Confirmed'}</td>
                  <td className="py-1.5 text-deck-body">{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
