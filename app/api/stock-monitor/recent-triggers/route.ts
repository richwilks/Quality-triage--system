import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

const RECENT_TRIGGERS_LIMIT = 10

// Cross-ticker summary of the most recent signal_log rows for everything on
// the user's watchlist, so they can see what's fired most recently without
// opening each ticker's chart individually. Optional ?action=BUY|SELL
// filters at the query level (before the limit), so "last 10 SELLs"
// actually returns 10 SELLs rather than whatever SELLs happened to be
// among the last 10 signals of any action.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const actionParam = req.nextUrl.searchParams.get('action')
  const action = actionParam === 'BUY' || actionParam === 'SELL' ? actionParam : null

  const watchlistDb = createWatchlistAdminClient()

  const { data: watchlistRows } = await watchlistDb.from('stock_watchlist').select('ticker').eq('user_id', user.id)
  const tickers = [...new Set((watchlistRows || []).map((row) => row.ticker))]
  if (tickers.length === 0) {
    return NextResponse.json({ triggers: [] })
  }

  let query = watchlistDb
    .from('signal_log')
    .select('ticker, signal_date, strategy, action, signal_strength, detail, created_at')
    .in('ticker', tickers)
  if (action) query = query.eq('action', action)

  const { data: triggers, error } = await query.order('created_at', { ascending: false }).limit(RECENT_TRIGGERS_LIMIT)

  if (error) {
    return NextResponse.json({ error: 'Could not load recent triggers' }, { status: 500 })
  }

  return NextResponse.json({ triggers: triggers || [] })
}
