'use client'

import { useEffect, useState } from 'react'
import { strategyLabel } from '@/lib/stockSignals'

type LiveTrade = {
  ticker: string
  currency: string
  environment: 'demo' | 'live'
  entry_date: string
  entry_price: number
  entry_strategy: string
  entry_detail: string | null
  quantity: number
  trading212_order_id: string | null
  exit_date: string | null
  exit_price: number | null
  exit_strategy: string | null
  exit_detail: string | null
  status: 'open' | 'closed'
  current_price: number
  current_value: number
  pnl: number
  return_pct: number
}

type LogEntry = {
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number | null
  trading212_order_id: string | null
  status: 'placed' | 'rejected' | 'error' | 'skipped'
  error_message: string | null
  environment: 'demo' | 'live'
  created_at: string
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function niceDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function niceDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_STYLE: Record<LogEntry['status'], string> = {
  placed: 'text-emerald-700',
  skipped: 'text-deck-dim',
  rejected: 'text-amber-700',
  error: 'text-red-700',
}

// Real-money counterpart to PaperTradingSummary - only ever shows anything
// once the user has turned on Trading 212 live trading in settings above
// (trading212_settings.enabled); otherwise both the ledger and the recent-
// activity log are empty.
export default function LiveTradingSummary() {
  const [trades, setTrades] = useState<LiveTrade[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock-monitor/live-trades')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load live trades')
      setTrades(body.trades)
      setLog(body.log || [])
    } catch (err: any) {
      setError(err.message || 'Could not load live trades')
    } finally {
      setLoading(false)
    }
  }

  if (!loading && !error && trades.length === 0 && log.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Trading 212 live trading</p>
      <p className="mt-1 text-sm text-deck-body">
        Real orders placed automatically on your Trading 212 account when a signal fires - this is{' '}
        <strong>not</strong> hypothetical like the paper-trading ledger above. Manage whether this runs, which
        environment (demo/live), and position sizing in the Trading 212 settings above.
      </p>

      {loading && <p className="mt-3 text-sm text-deck-dim">Loading...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!loading && !error && trades.some((t) => t.status === 'open') && (
        <p className="mt-3 text-xs text-deck-dim">
          Currently invested (open positions, cost basis):{' '}
          <strong className="text-deck-text">
            {trades
              .filter((t) => t.status === 'open')
              .reduce((sum, t) => sum + t.quantity * t.entry_price, 0)
              .toFixed(2)}
          </strong>{' '}
          - compared against your total investment limit (if set) in Trading 212 settings above.
        </p>
      )}

      {!loading && !error && trades.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-deck-dim">
                <th className="py-1 pr-3 font-medium">Ticker</th>
                <th className="py-1 pr-3 font-medium">Env</th>
                <th className="py-1 pr-3 font-medium">Entry</th>
                <th className="py-1 pr-3 font-medium">Exit</th>
                <th className="py-1 pr-3 font-medium">P&amp;L</th>
                <th className="py-1 font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, idx) => (
                <tr key={idx} className="border-t border-deck-border">
                  <td className="py-1.5 pr-3 font-semibold text-deck-text">{t.ticker}</td>
                  <td className="py-1.5 pr-3 text-deck-dim">{t.environment}</td>
                  <td className="py-1.5 pr-3 text-deck-body">
                    {niceDate(t.entry_date)} @ {formatMoney(t.entry_price, t.currency)} × {t.quantity}
                    <span className="block text-deck-dim">{strategyLabel(t.entry_strategy)}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-deck-body">
                    {t.status === 'open' ? (
                      <>Open — now {formatMoney(t.current_price, t.currency)}</>
                    ) : (
                      <>
                        {niceDate(t.exit_date!)} @ {formatMoney(t.exit_price!, t.currency)}
                        <span className="block text-deck-dim">{strategyLabel(t.exit_strategy!)}</span>
                      </>
                    )}
                  </td>
                  <td className={`py-1.5 pr-3 font-semibold ${t.pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {t.pnl >= 0 ? '+' : ''}
                    {formatMoney(t.pnl, t.currency)}
                  </td>
                  <td className={`py-1.5 font-semibold ${t.return_pct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {t.return_pct >= 0 ? '+' : ''}
                    {t.return_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && log.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Recent order activity</p>
          <p className="mt-1 text-xs text-deck-dim">
            Every attempt, including ones that didn&apos;t result in a trade - a skipped allocation, a rejected or
            errored order - not just successful fills.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-deck-dim">
                  <th className="py-1 pr-3 font-medium">When</th>
                  <th className="py-1 pr-3 font-medium">Ticker</th>
                  <th className="py-1 pr-3 font-medium">Side</th>
                  <th className="py-1 pr-3 font-medium">Qty</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l, idx) => (
                  <tr key={idx} className="border-t border-deck-border">
                    <td className="py-1.5 pr-3 text-deck-body">{niceDateTime(l.created_at)}</td>
                    <td className="py-1.5 pr-3 font-semibold text-deck-text">{l.ticker}</td>
                    <td className="py-1.5 pr-3 text-deck-body">{l.side}</td>
                    <td className="py-1.5 pr-3 text-deck-body">{l.quantity ?? '—'}</td>
                    <td className={`py-1.5 font-semibold ${STATUS_STYLE[l.status]}`} title={l.error_message || ''}>
                      {l.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
