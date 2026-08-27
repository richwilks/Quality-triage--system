import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  let { data } = await supabase
    .from('stock_watchlist')
    .select('ticker')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // First visit: seed the same default watchlist the standalone monitor
  // script starts with, so the page isn't empty out of the box.
  if (!data || data.length === 0) {
    await supabase
      .from('stock_watchlist')
      .insert(DEFAULT_WATCHLIST.map((ticker) => ({ user_id: user.id, ticker })))

    const seeded = await supabase
      .from('stock_watchlist')
      .select('ticker')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    data = seeded.data
  }

  return NextResponse.json({ tickers: (data || []).map((row) => row.ticker) })
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

  const { error } = await supabase.from('stock_watchlist').insert({ user_id: user.id, ticker })

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

  await supabase.from('stock_watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)

  return NextResponse.json({ ok: true })
}
