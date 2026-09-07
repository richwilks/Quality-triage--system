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
    .select('ticker, confidence_mode')
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
      .select('ticker, confidence_mode')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    data = seeded.data
  }

  const rows = data || []
  return NextResponse.json({
    tickers: rows.map((row) => row.ticker),
    // Kept as a separate map (rather than reshaping `tickers`) so every
    // existing consumer keyed on the plain ticker-string array is
    // unaffected by this addition.
    confidenceModeByTicker: Object.fromEntries(rows.map((row) => [row.ticker, !!row.confidence_mode])),
  })
}

// Toggles combined-confidence-score alerting mode for one ticker on this
// user's own watchlist (see lib/stockSignals.ts's computeConfidenceScores)
// - per (user, ticker), not global, since stock_watchlist is already one
// row per pair.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { ticker: rawTicker, confidenceMode } = await req.json()
  const ticker = String(rawTicker || '').toUpperCase().trim()
  if (!TICKER_PATTERN.test(ticker) || typeof confidenceMode !== 'boolean') {
    return NextResponse.json({ error: 'Invalid ticker or confidenceMode' }, { status: 400 })
  }

  const { error } = await createWatchlistAdminClient()
    .from('stock_watchlist')
    .update({ confidence_mode: confidenceMode })
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
