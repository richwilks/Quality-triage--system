import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

const TICKER_PATTERN = /^[A-Z0-9.-]{1,10}$/
const DEFAULT_WATCHLIST = ['NVDA']

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const watchlistDb = createWatchlistAdminClient()

  let { data } = await watchlistDb
    .from('stock_watchlist')
    .select('ticker, confidence_mode, invested')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // First visit: seed the same default watchlist the standalone monitor
  // script starts with, so the page isn't empty out of the box.
  if (!data || data.length === 0) {
    await watchlistDb
      .from('stock_watchlist')
      .insert(DEFAULT_WATCHLIST.map((ticker) => ({ user_id: user.id, ticker })))

    const seeded = await watchlistDb
      .from('stock_watchlist')
      .select('ticker, confidence_mode, invested')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    data = seeded.data
  }

  const rows = data || []
  return NextResponse.json({
    tickers: rows.map((row) => row.ticker),
    // Kept as separate maps (rather than reshaping `tickers`) so every
    // existing consumer keyed on the plain ticker-string array is
    // unaffected by these additions.
    confidenceModeByTicker: Object.fromEntries(rows.map((row) => [row.ticker, !!row.confidence_mode])),
    // Purely informational - "have I actually put real money into this
    // one," separate from confidence_mode's alerting-style toggle. Doesn't
    // feed signal computation, alerting, or the paper-trading ledger.
    investedByTicker: Object.fromEntries(rows.map((row) => [row.ticker, !!row.invested])),
  })
}

// Toggles either combined-confidence-score alerting mode (see
// lib/stockSignals.ts's computeConfidenceScores) or the "I actually hold
// this" flag for one ticker on this user's own watchlist - per (user,
// ticker), not global, since stock_watchlist is already one row per pair.
// Exactly one of confidenceMode/invested is expected per call, matching how
// the UI's two separate toggle affordances each call this independently.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { ticker: rawTicker, confidenceMode, invested } = await req.json()
  const ticker = String(rawTicker || '').toUpperCase().trim()
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const update: { confidence_mode?: boolean; invested?: boolean } = {}
  if (typeof confidenceMode === 'boolean') update.confidence_mode = confidenceMode
  if (typeof invested === 'boolean') update.invested = invested
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Provide confidenceMode or invested as a boolean' }, { status: 400 })
  }

  const { error } = await createWatchlistAdminClient()
    .from('stock_watchlist')
    .update(update)
    .eq('user_id', user.id)
    .eq('ticker', ticker)

  if (error) {
    return NextResponse.json({ error: 'Could not update ticker' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { ticker: rawTicker } = await req.json()
  const ticker = String(rawTicker || '').toUpperCase().trim()
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json(
      { error: 'Enter a valid ticker symbol (letters/numbers, up to 10 characters)' },
      { status: 400 }
    )
  }

  const { error } = await createWatchlistAdminClient()
    .from('stock_watchlist')
    .insert({ user_id: user.id, ticker })

  // Postgres unique_violation (already on the list) is not an error here.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not add ticker' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') || '').toUpperCase().trim()
  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })
  }

  await createWatchlistAdminClient()
    .from('stock_watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('ticker', ticker)

  return NextResponse.json({ ok: true })
}
