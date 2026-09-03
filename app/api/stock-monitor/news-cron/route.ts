import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cronAuth'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { fetchCompanyNews } from '@/lib/finnhub'
import { scoreNewsSentiments } from '@/lib/anthropic'

// Bumped from 60s: the per-ticker loop below is sequential, and a bigger
// watchlist (e.g. the Nasdaq-100 top 20 + QQQ bulk-add) needs more headroom.
export const maxDuration = 120

// Hourly Vercel Cron job (see vercel.json) - hourly rather than daily like
// backtest-cron, since news breaks intraday unlike the daily-bar price
// signals.
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const supabaseAdmin = createWatchlistAdminClient()

  const { data: watchlistRows, error } = await supabaseAdmin.from('stock_watchlist').select('ticker')
  if (error) {
    return NextResponse.json({ error: 'Could not load watchlists' }, { status: 500 })
  }

  const tickers = [...new Set((watchlistRows || []).map((row) => row.ticker))]
  const summary: { ticker: string; fetched: number; new: number; error?: string }[] = []

  for (const ticker of tickers) {
    const result = await fetchCompanyNews(ticker)
    if (!result.ok) {
      summary.push({ ticker, fetched: 0, new: 0, error: result.error })
      continue
    }

    if (result.data.length === 0) {
      summary.push({ ticker, fetched: 0, new: 0 })
      continue
    }

    // Skip articles already stored (by url) - unique(ticker, url) also
    // guards this at the DB level, but checking first avoids re-scoring
    // (and paying for) articles we already have on every hourly run.
    const urls = result.data.map((a) => a.url)
    const { data: existing } = await supabaseAdmin
      .from('stock_news')
      .select('url')
      .eq('ticker', ticker)
      .in('url', urls)
    const existingUrls = new Set((existing || []).map((row) => row.url))
    const newArticles = result.data.filter((a) => !existingUrls.has(a.url))

    if (newArticles.length === 0) {
      summary.push({ ticker, fetched: result.data.length, new: 0 })
      continue
    }

    const scores = await scoreNewsSentiments(
      newArticles.map((a) => ({ headline: a.headline, summary: a.summary }))
    )

    await supabaseAdmin.from('stock_news').upsert(
      newArticles.map((a, i) => ({
        ticker,
        headline: a.headline,
        summary: a.summary || null,
        source: a.source,
        url: a.url,
        published_at: a.publishedAt,
        sentiment_score: scores[i],
      })),
      { onConflict: 'ticker,url', ignoreDuplicates: true }
    )

    summary.push({ ticker, fetched: result.data.length, new: newArticles.length })
  }

  return NextResponse.json({ summary })
}
