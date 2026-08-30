'use client'

import { useEffect, useState } from 'react'
import { strategyLabel } from '@/lib/stockSignals'

type Trade = {
  ticker: string
  currency: string
  entry_date: string
  entry_price: number
  entry_strategy: string
  entry_detail: string | null
  invested_amount: number
  shares: number
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

type Summary = {
  currency: string
  tradeCount: number
  totalInvested: number
  currentValue: number
  pnl: number
  returnPct: number
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

export default function PaperTradingSummary() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock-monitor/paper-trades')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load paper trades')
      setTrades(body.trades)
      setSummaries(body.summaries)
    } catch (err: any) {
      setError(err.message || 'Could not load paper trades')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Paper trading ledger</p>
      <p className="mt-1 text-sm text-deck-body">
        Simulates investing 100 units of each ticker's own trading currency at every BUY
        signal and selling at the next SELL, per ticker. Hypothetical only - no real
        money moves. Updated daily.
      </p>

      {loading && <p className="mt-3 text-sm text-deck-dim">Loading...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!loading && !error && trades.length === 0 && (
        <p className="mt-3 text-sm text-deck-dim">No signals have fired yet for your watchlist.</p>
      )}

      {!loading && !error && trades.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-4">
            {summaries.map((s) => (
              <div key={s.currency} className="rounded-lg border border-deck-border bg-deck-raised px-4 py-3">
                <p className="text-xs text-deck-dim">
                  {s.tradeCount} trade{s.tradeCount === 1 ? '' : 's'} · {s.currency}
                </p>
                <p className="mt-1 text-lg font-semibold text-deck-text">
                  {formatMoney(s.currentValue, s.currency)}
                </p>
                <p className={`text-sm font-medium ${s.pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {s.pnl >= 0 ? '+' : ''}
                  {formatMoney(s.pnl, s.currency)} ({s.returnPct >= 0 ? '+' : ''}
                  {s.returnPct.toFixed(1)}%) on {formatMoney(s.totalInvested, s.currency)} invested
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-deck-dim">
                  <th className="py-1 pr-3 font-medium">Ticker</th>
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
                    <td className="py-1.5 pr-3 text-deck-body">
                      {niceDate(t.entry_date)} @ {formatMoney(t.entry_price, t.currency)}
                      <span className="block text-deck-dim">{strategyLabel(t.entry_strategy)}</span>
                      {t.entry_detail && (
                        <span className="block max-w-xs text-deck-dim" title={t.entry_detail}>
                          {t.entry_detail}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-deck-body">
                      {t.status === 'open' ? (
                        <>
                          Open — now {formatMoney(t.current_price, t.currency)}
                        </>
                      ) : (
                        <>
                          {niceDate(t.exit_date!)} @ {formatMoney(t.exit_price!, t.currency)}
                          <span className="block text-deck-dim">{strategyLabel(t.exit_strategy!)}</span>
                          {t.exit_detail && (
                            <span className="block max-w-xs text-deck-dim" title={t.exit_detail}>
                              {t.exit_detail}
                            </span>
                          )}
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
        </>
      )}
    </div>
  )
}
