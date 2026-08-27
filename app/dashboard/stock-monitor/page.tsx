import PageHeader from '@/components/PageHeader'

// Unlisted page: intentionally not linked from Sidebar/BottomNav/QUICK_LINKS
// while the stock signal monitor project is under development. Reachable
// only via direct URL (/dashboard/stock-monitor); still behind the normal
// auth check in middleware.ts like every other /dashboard route.

const WATCHLIST = ['NVDA']

const STRATEGIES = [
  {
    name: 'SMA Crossover',
    detail: '50-day vs 200-day simple moving average. A golden cross (50-day crosses above the 200-day) flags BUY; a death cross (50-day crosses below the 200-day) flags SELL.',
  },
  {
    name: 'RSI (14-day)',
    detail: 'Flags BUY when RSI drops to 30 or below (oversold), and SELL when RSI rises to 70 or above (overbought).',
  },
]

export default function StockMonitorPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Stock Signal Monitor" />

        <span className="mt-2 inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          In development — not yet wired to live data
        </span>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">
            About
          </p>
          <p className="mt-1 text-sm text-deck-body">
            A standalone Python tool that watches a ticker watchlist, computes
            technical-analysis signals, and emails an alert when one triggers.
            It currently runs separately from this app (see the{' '}
            <code className="rounded bg-deck-raised px-1 py-0.5 text-xs">
              stock-signal-monitor/
            </code>{' '}
            project in this repo) — this page is a placeholder for a future
            in-app view of its status.
          </p>

          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-deck-dim">
            Watchlist
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {WATCHLIST.map((ticker) => (
              <span
                key={ticker}
                className="rounded-md bg-deck-raised px-2 py-1 text-sm font-semibold text-deck-text"
              >
                {ticker}
              </span>
            ))}
          </div>

          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-deck-dim">
            Strategies
          </p>
          <div className="mt-2 space-y-3">
            {STRATEGIES.map((strategy) => (
              <div key={strategy.name}>
                <p className="text-sm font-semibold text-deck-text">{strategy.name}</p>
                <p className="mt-0.5 text-sm text-deck-body">{strategy.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-deck-dim">
          Decision-support only, based on lagging technical indicators — not
          financial advice.
        </p>
      </div>
    </div>
  )
}
