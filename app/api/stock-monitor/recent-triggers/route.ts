import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

const RECENT_TRIGGERS_LIMIT = 10

// Cross-ticker summary of the most recent signal_log rows for everything on
// the user's watchlist, so they can see what's fired most recently without
// opening each ticker's chart individually.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const watchlistDb = createWatchlistAdminClient()

  const { data: watchlistRows } = await watchlistDb.from('stock_watchlist').select('ticker').eq('user_id', user.id)
  const tickers = [...new Set((watchlistRows || []).map((row) => row.ticker))]
  if (tickers.length === 0) {
    return NextResponse.json({ triggers: [] })
  }

  const { data: triggers, error } = await watchlistDb
    .from('signal_log')
    .select('ticker, signal_date, strategy, action, signal_strength, detail, created_at')
    .in('ticker', tickers)
    .order('created_at', { ascending: false })
    .limit(RECENT_TRIGGERS_LIMIT)

  if (error) {
    return NextResponse.json({ error: 'Could not load recent triggers' }, { status: 500 })
  }

  return NextResponse.json({ triggers: triggers || [] })
}
