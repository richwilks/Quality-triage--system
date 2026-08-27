import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { fetchDailyCloses } from '@/lib/yahooFinance'

export const maxDuration = 20

interface TradeRow {
  ticker: string
  currency: string
  entry_date: string
  entry_price: number
  entry_strategy: string
  invested_amount: number
  shares: number
  exit_date: string | null
  exit_price: number | null
  exit_strategy: string | null
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

  const { data: trades, error } = await createWatchlistAdminClient()
    .from('paper_trades')
    .select(
      'ticker, currency, entry_date, entry_price, entry_strategy, invested_amount, shares, exit_date, exit_price, exit_strategy, status'
    )
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Could not load paper trades' }, { status: 500 })
  }

  const rows = (trades || []) as TradeRow[]

  // Open positions are marked-to-market at the latest close - fetch it once
  // per distinct open ticker rather than once per trade.
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
    const currentValue = t.shares * currentPrice
    return {
      ...t,
      current_price: currentPrice,
      current_value: currentValue,
      pnl: currentValue - t.invested_amount,
      return_pct: ((currentValue - t.invested_amount) / t.invested_amount) * 100,
    }
  })

  // Summaries never mix currencies - a USD ticker and a GBP ticker are never
  // summed into one number.
  const summaryByCurrency = new Map<
    string,
    { currency: string; tradeCount: number; totalInvested: number; currentValue: number }
  >()
  for (const t of withValue) {
    const s = summaryByCurrency.get(t.currency) || {
      currency: t.currency,
      tradeCount: 0,
      totalInvested: 0,
      currentValue: 0,
    }
    s.tradeCount += 1
    s.totalInvested += t.invested_amount
    s.currentValue += t.current_value
    summaryByCurrency.set(t.currency, s)
  }

  const summaries = [...summaryByCurrency.values()].map((s) => ({
    ...s,
    pnl: s.currentValue - s.totalInvested,
    returnPct: ((s.currentValue - s.totalInvested) / s.totalInvested) * 100,
  }))

  return NextResponse.json({ trades: withValue, summaries })
}
