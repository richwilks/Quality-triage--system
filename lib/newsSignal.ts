// Turns fetched, sentiment-scored news (lib/finnhub.ts + scoreNewsSentiments
// in lib/anthropic.ts) into BUY/SELL signals, kept separate from
// computeSignals in lib/stockSignals.ts so that function stays pure/
// synchronous/price-only - callers that need both (app/api/stock-monitor/
// history and backtest-cron routes) merge the two signal arrays themselves.
//
// Honesty note: unlike SMA crossover/MACD/RSI (decades of established
// technical-analysis use), LLM-scored headline sentiment is an experimental
// signal with no comparable track record - flagged as such in the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockSignal } from './stockSignals'

export const NEWS_LOOKBACK_DAYS = 3
export const NEWS_BULLISH_THRESHOLD = 0.3
export const NEWS_BEARISH_THRESHOLD = -0.3

export interface NewsItem {
  publishedAt: string // ISO date/datetime
  sentimentScore: number
  headline: string
}

const MAX_HEADLINE_CHARS = 80

function truncateHeadline(headline: string): string {
  return headline.length > MAX_HEADLINE_CHARS ? `${headline.slice(0, MAX_HEADLINE_CHARS - 1)}…` : headline
}

// Names the single article that actually drove the average past the
// threshold - the highest-scored one for a BUY, lowest for a SELL - so the
// signal's `detail` cites something concrete, not just the rolling number.
function mostInfluentialHeadline(inWindow: NewsItem[], action: 'BUY' | 'SELL'): NewsItem {
  return inWindow.reduce((best, n) =>
    action === 'BUY' ? (n.sentimentScore > best.sentimentScore ? n : best) : (n.sentimentScore < best.sentimentScore ? n : best)
  )
}

// For each date in `dates`, averages sentimentScore over news published in
// the trailing NEWS_LOOKBACK_DAYS days (inclusive of that date). Fires
// 'NEWS' BUY/SELL only on the day that rolling average CROSSES into
// bullish/bearish territory - the same "fires once on entry, not every day
// it stays there" pattern already used for RSI in stockSignals.ts, not a
// signal every day sentiment happens to sit past the threshold.
export function computeNewsSignal(dates: string[], news: NewsItem[]): StockSignal[] {
  const signals: StockSignal[] = []
  if (dates.length === 0 || news.length === 0) return signals

  const sorted = [...news].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
  const lookbackMs = NEWS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  let prevAvg: number | null = null
  for (let i = 0; i < dates.length; i++) {
    const dayEnd = new Date(`${dates[i]}T23:59:59.999Z`).getTime()
    const windowStart = dayEnd - lookbackMs

    const inWindow = sorted.filter((n) => {
      const t = new Date(n.publishedAt).getTime()
      return t <= dayEnd && t > windowStart
    })

    if (inWindow.length === 0) {
      prevAvg = null // no recent news - treat the next reading as a fresh start, same as RSI's gap handling
      continue
    }

    const avg = inWindow.reduce((sum, n) => sum + n.sentimentScore, 0) / inWindow.length

    if ((prevAvg === null || prevAvg <= NEWS_BULLISH_THRESHOLD) && avg > NEWS_BULLISH_THRESHOLD) {
      const top = mostInfluentialHeadline(inWindow, 'BUY')
      signals.push({
        strategy: 'NEWS',
        action: 'BUY',
        date: dates[i],
        index: i,
        detail: `News sentiment (${NEWS_LOOKBACK_DAYS}-day avg) = ${avg.toFixed(2)}, crossed above the bullish threshold of ${NEWS_BULLISH_THRESHOLD}. Most influential headline: "${truncateHeadline(top.headline)}" (${top.sentimentScore >= 0 ? '+' : ''}${top.sentimentScore.toFixed(2)}).`,
        strength: 'CONFIRMED',
      })
    } else if ((prevAvg === null || prevAvg >= NEWS_BEARISH_THRESHOLD) && avg < NEWS_BEARISH_THRESHOLD) {
      const top = mostInfluentialHeadline(inWindow, 'SELL')
      signals.push({
        strategy: 'NEWS',
        action: 'SELL',
        date: dates[i],
        index: i,
        detail: `News sentiment (${NEWS_LOOKBACK_DAYS}-day avg) = ${avg.toFixed(2)}, crossed below the bearish threshold of ${NEWS_BEARISH_THRESHOLD}. Most influential headline: "${truncateHeadline(top.headline)}" (${top.sentimentScore >= 0 ? '+' : ''}${top.sentimentScore.toFixed(2)}).`,
        strength: 'CONFIRMED',
      })
    }
    prevAvg = avg
  }

  return signals
}

// Supabase-aware wrapper: loads this ticker's recently-scored news and
// hands it to the pure computeNewsSignal above. Used by both the history
// route (for the chart's signal table) and the daily backtest cron (so
// NEWS signals open/close simulated positions the same as the others).
export async function fetchNewsSignals(
  supabase: SupabaseClient,
  ticker: string,
  dates: string[]
): Promise<StockSignal[]> {
  if (dates.length === 0) return []

  const lookbackStart = new Date(dates[0])
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - NEWS_LOOKBACK_DAYS)

  const { data } = await supabase
    .from('stock_news')
    .select('published_at, sentiment_score, headline')
    .eq('ticker', ticker)
    .gte('published_at', lookbackStart.toISOString())

  const news: NewsItem[] = (data || []).map((row: any) => ({
    publishedAt: row.published_at,
    sentimentScore: row.sentiment_score,
    headline: row.headline,
  }))

  return computeNewsSignal(dates, news)
}
