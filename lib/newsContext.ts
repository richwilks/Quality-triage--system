// Recent-headlines context attached to signal alerts (watch and confirmed
// alike) - distinct from lib/newsSignal.ts, which uses stored, pre-scored
// sentiment to generate its own NEWS-strategy BUY/SELL signal. This is
// simpler: just "what's been published very recently" for a human reading
// the alert, not an input to any signal math.

import { fetchCompanyNews, type FinnhubArticle } from './finnhub'

const RECENT_HEADLINES_DAYS = 2 // ~48 hours
const MAX_HEADLINES = 3

export interface RecentHeadline {
  headline: string
  url: string
}

export type FetchRecentHeadlinesResult = { ok: true; data: RecentHeadline[] } | { ok: false; error: string }

export async function fetchRecentHeadlines(ticker: string): Promise<FetchRecentHeadlinesResult> {
  const result = await fetchCompanyNews(ticker, RECENT_HEADLINES_DAYS)
  if (!result.ok) return { ok: false, error: result.error }

  const sorted = [...result.data].sort((a: FinnhubArticle, b: FinnhubArticle) => b.publishedAt.localeCompare(a.publishedAt))
  const top = sorted.slice(0, MAX_HEADLINES).map((a) => ({ headline: a.headline, url: a.url }))
  return { ok: true, data: top }
}

// Pure formatter, used both for the email body and the signal_log record -
// null when there's nothing to show, so callers can skip the "Recent
// headlines" section entirely rather than printing an empty one.
export function formatNewsSnippet(headlines: RecentHeadline[]): string | null {
  if (headlines.length === 0) return null
  return headlines.map((h) => `"${h.headline}" - ${h.url}`).join('\n')
}
