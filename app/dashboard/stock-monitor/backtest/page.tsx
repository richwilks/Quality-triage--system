'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { estimateNewsAiCost } from '@/lib/aiCostEstimate'

// Unlisted page, same as the parent /dashboard/stock-monitor - reachable
// only via that page's "What if?" link.

type BacktestSummary = {
  months: number
  windowStart: string
  perTicker: {
    ticker: string
    currency: string
    trades: number
    invested: number
    pnl: number
    returnPct: number | null
    stillOpen: boolean
    error?: string
  }[]
  totalsByCurrency: Record<string, { invested: number; pnl: number }>
}

export default function StockMonitorBacktestPage() {
  const [months, setMonths] = useState(18)
  const [articlesPerDay, setArticlesPerDay] = useState(2)
  const [result, setResult] = useState<BacktestSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCalculate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock-monitor/backtest-summary?months=${months}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not run backtest')
      setResult(body)
    } catch (err: any) {
      setError(err.message || 'Could not run backtest')
    } finally {
      setLoading(false)
    }
  }

  const tickerCount = result ? result.perTicker.filter((t) => !t.error).length : 0
  const aiCost = result
    ? estimateNewsAiCost({ months: result.months, tickerCount, avgArticlesPerTickerPerDay: articlesPerDay })
    : null
  const usdTotals = result?.totalsByCurrency.USD

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard/stock-monitor" className="text-sm text-deck-dim hover:text-deck-text">
          ← Back to Stock Signal Monitor
        </Link>

        <PageHeader title="What if?" />

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Trading result</p>
          <p className="mt-1 text-xs text-deck-dim">
            Simulates investing 100 units of each stock&apos;s own currency on every BUY signal and selling in
            full on every SELL signal across your whole watchlist, using live historical price data - not the
            live paper-trading ledger, which only started accumulating recently. Technical signals only (SMA
            crossover, MACD, RSI) - news-driven signals can&apos;t be reconstructed this far back.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-deck-text">
              Lookback (months)
              <input
                type="number"
                min={1}
                max={48}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) || 18)}
                className="w-16 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text"
              />
            </label>
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Calculating...' : 'Calculate'}
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {result && (
            <div className="mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-deck-dim">
                    <th className="pb-1">Ticker</th>
                    <th className="pb-1">Trades</th>
                    <th className="pb-1">Invested</th>
                    <th className="pb-1">P&amp;L</th>
                    <th className="pb-1">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perTicker.map((t) => (
                    <tr key={t.ticker} className="border-t border-deck-border">
                      <td className="py-1 font-medium text-deck-text">{t.ticker}</td>
                      {t.error ? (
                        <td className="py-1 text-red-600" colSpan={4}>
                          {t.error}
                        </td>
                      ) : (
                        <>
                          <td className="py-1 text-deck-text">
                            {t.trades}
                            {t.stillOpen ? ' (+1 open)' : ''}
                          </td>
                          <td className="py-1 text-deck-text">
                            {t.invested.toFixed(0)} {t.currency}
                          </td>
                          <td className={`py-1 ${t.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {t.pnl >= 0 ? '+' : ''}
                            {t.pnl.toFixed(2)} {t.currency}
                          </td>
                          <td className={`py-1 ${t.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {t.returnPct === null ? '-' : `${t.returnPct >= 0 ? '+' : ''}${t.returnPct.toFixed(1)}%`}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 space-y-1 text-sm">
                {Object.entries(result.totalsByCurrency).map(([currency, totals]) => (
                  <p key={currency} className={totals.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    Total in {currency}: {totals.pnl >= 0 ? '+' : ''}
                    {totals.pnl.toFixed(2)} {currency} on {totals.invested.toFixed(0)} {currency} invested (
                    {((totals.pnl / totals.invested) * 100).toFixed(1)}%)
                  </p>
                ))}
              </div>

              <p className="mt-2 text-xs text-deck-dim">
                Since {result.windowStart}. Figures are in each stock&apos;s own currency (e.g. USD for a
                US-listed stock) - not converted to GBP, since an accurate conversion would need the historical
                exchange rate on each trade date, not today&apos;s rate.
              </p>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Estimated cost of running the AI</p>
            <p className="mt-1 text-xs text-deck-dim">
              This is an estimate, not real billing data - this app has no access to actual Anthropic usage
              records. It applies current Claude Sonnet 5 pricing ($2/1M input tokens, $10/1M output tokens) to a
              simplified model of the news-sentiment scoring calls (app/api/stock-monitor/news-cron), assuming one
              scoring call per ticker per day. Adjust the assumption below to match what you'd actually expect.
            </p>

            <label className="mt-3 flex items-center gap-1.5 text-sm text-deck-text">
              Avg new articles scored per ticker per day
              <input
                type="number"
                min={0}
                step={0.5}
                value={articlesPerDay}
                onChange={(e) => setArticlesPerDay(Number(e.target.value) || 0)}
                className="w-16 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text"
              />
            </label>

            {aiCost && (
              <div className="mt-3 space-y-1 text-sm text-deck-text">
                <p>
                  Across {tickerCount} ticker{tickerCount === 1 ? '' : 's'} over {result.months} months: estimated{' '}
                  <span className="font-semibold">${aiCost.costUsd.toFixed(2)}</span> in Anthropic API spend.
                </p>
                <p className="text-xs text-deck-dim">
                  ({aiCost.totalArticles.toFixed(0)} articles scored across ~{aiCost.totalCalls.toFixed(0)} scoring
                  calls)
                </p>
              </div>
            )}

            {aiCost && usdTotals && (
              <p className="mt-3 text-sm">
                Net for your USD-denominated tickers:{' '}
                <span className={usdTotals.pnl - aiCost.costUsd >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                  {usdTotals.pnl - aiCost.costUsd >= 0 ? '+' : ''}
                  {(usdTotals.pnl - aiCost.costUsd).toFixed(2)} USD
                </span>{' '}
                (trading P&amp;L minus estimated AI cost)
              </p>
            )}
            {aiCost && !usdTotals && (
              <p className="mt-3 text-xs text-deck-dim">
                None of your tickers trade in USD, so there's no USD trading total to net the (USD) AI cost
                against directly - see the trading result above in each stock's own currency instead.
              </p>
            )}
            {aiCost && Object.keys(result.totalsByCurrency).some((c) => c !== 'USD') && (
              <p className="mt-2 text-xs text-deck-dim">
                Non-USD tickers' trading P&amp;L isn't netted against this cost, since converting would need a
                real exchange rate rather than an assumption.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
