'use client'

import { useEffect, useState } from 'react'

type Article = {
  headline: string
  summary: string | null
  source: string | null
  url: string
  published_at: string
  sentiment_score: number
}

function sentimentLabel(score: number): { text: string; className: string } {
  if (score > 0.3) return { text: 'Bullish', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  if (score < -0.3) return { text: 'Bearish', className: 'text-red-700 bg-red-50 border-red-200' }
  return { text: 'Neutral', className: 'text-deck-dim bg-deck-raised border-deck-border' }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NewsFeed({ ticker }: { ticker: string }) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [ticker])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stock-monitor/news?ticker=${encodeURIComponent(ticker)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load news')
      setArticles(body.articles)
    } catch (err: any) {
      setError(err.message || 'Could not load news')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">News - {ticker}</p>
      <p className="mt-1 text-xs text-deck-dim">
        Sentiment is scored by an LLM from the headline/summary, not a proven indicator like the technical
        signals above - experimental.
      </p>

      {loading && <p className="mt-3 text-sm text-deck-dim">Loading...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className="mt-3 text-sm text-deck-dim">No recent news for {ticker} yet.</p>
      )}

      {!loading && !error && articles.length > 0 && (
        <ul className="mt-3 space-y-3">
          {articles.map((a, idx) => {
            const sentiment = sentimentLabel(a.sentiment_score)
            return (
              <li key={idx} className="border-t border-deck-border pt-3 first:border-t-0 first:pt-0">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-deck-text hover:text-deck-accent"
                >
                  {a.headline}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-deck-dim">
                  <span>{a.source || 'Unknown source'}</span>
                  <span>·</span>
                  <span>{relativeTime(a.published_at)}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-medium ${sentiment.className}`}>
                    {sentiment.text}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
