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

// Cross-ticker summary of the most recent signal_log rows for the whole
// watchlist, so a fired signal is visible here without opening that
// ticker's chart individually.
export default function RecentTriggers() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock-monitor/recent-triggers')
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
      <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Recent triggers</p>
      <p className="mt-1 text-xs text-deck-dim">
        The last 10 signals across your whole watchlist, newest first - both watch and confirmed.
      </p>

      {loading && <p className="mt-3 text-sm text-deck-dim">Loading...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!loading && !error && triggers.length === 0 && (
        <p className="mt-3 text-sm text-deck-dim">
          No signals recorded yet - this fills in as the intraday check runs.
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
                  <td className="py-1.5 pr-3 text-deck-body">{niceDateTime(t.created_at)}</td>
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
