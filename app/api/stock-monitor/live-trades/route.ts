import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { fetchDailyCloses } from '@/lib/yahooFinance'

export const maxDuration = 20

interface LiveTradeRow {
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
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const watchlistDb = createWatchlistAdminClient()

  const { data: trades, error } = await watchlistDb
    .from('live_trades')
    .select(
      'ticker, currency, environment, entry_date, entry_price, entry_strategy, entry_detail, quantity, trading212_order_id, exit_date, exit_price, exit_strategy, exit_detail, status'
    )
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Could not load live trades' }, { status: 500 })
  }

  const rows = (trades || []) as LiveTradeRow[]

  // Mark open positions to market, same as the paper-trades route - one
  // fetch per distinct open ticker, not per trade.
  const openTickers = [...new Set(rows.filter((t) => t.status === 'open').map((t) => t.ticker))]
  const latestClose = new Map<string, number>()
  for (const ticker of openTickers) {
    const result = await fetchDailyCloses(ticker)
    if (result.ok && result.data.close.length > 0) {
      latestClose.set(ticker, result.data.close[result.data.close.length - 1])
    }
  }

  const withValue = rows.map((t) => {
    const currentPrice = t.status === 'open' ? latestClose.get(t.ticker) ?? t.entry_price : t.exit_price!
    const investedAmount = t.quantity * t.entry_price
    const currentValue = t.quantity * currentPrice
    return {
      ...t,
      current_price: currentPrice,
      current_value: currentValue,
      pnl: currentValue - investedAmount,
      return_pct: investedAmount > 0 ? ((currentValue - investedAmount) / investedAmount) * 100 : 0,
    }
  })

  // Recent attempts (placed, rejected, errored, skipped) - what the bot
  // actually did or tried, including the ones that never made it into the
  // ledger above.
  const { data: log } = await watchlistDb
    .from('live_trade_log')
    .select('ticker, side, quantity, trading212_order_id, status, error_message, environment, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(25)

  return NextResponse.json({ trades: withValue, log: log || [] })
}
