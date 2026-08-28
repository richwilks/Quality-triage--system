import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

const TICKER_PATTERN = /^[A-Z0-9.-]{1,10}$/

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') || '').toUpperCase().trim()
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  const { data, error } = await createWatchlistAdminClient()
    .from('stock_news')
    .select('headline, summary, source, url, published_at, sentiment_score')
    .eq('ticker', ticker)
    .order('published_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Could not load news' }, { status: 500 })
  }

  return NextResponse.json({ articles: data || [] })
}
