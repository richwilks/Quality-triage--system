// Ticker-native company news via Finnhub's free tier - needs FINNHUB_API_KEY
// (the user signs up at finnhub.io; there's no free/keyless news API the
// way Yahoo Finance's chart endpoint gives free price data).

export interface FinnhubArticle {
  headline: string
  summary: string
  source: string
  url: string
  publishedAt: string // ISO date
}

export type FetchCompanyNewsResult =
  | { ok: true; data: FinnhubArticle[] }
  | { ok: false; status: number; error: string }

function finnhubUrl(ticker: string, fromDate: string, toDate: string): string {
  const params = new URLSearchParams({
    symbol: ticker,
    from: fromDate,
    to: toDate,
    token: process.env.FINNHUB_API_KEY || '',
  })
  return `https://finnhub.io/api/v1/company-news?${params.toString()}`
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Fetches company news for the trailing `days` days (default 3, matching
// the rolling window computeNewsSignal averages over).
export async function fetchCompanyNews(ticker: string, days: number = 3): Promise<FetchCompanyNewsResult> {
  if (!process.env.FINNHUB_API_KEY) {
    return { ok: false, status: 500, error: 'FINNHUB_API_KEY is not configured' }
  }

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  let json: any
  try {
    const res = await fetch(finnhubUrl(ticker, formatDate(from), formatDate(to)))
    if (!res.ok) throw new Error(`Finnhub returned ${res.status}`)
    json = await res.json()
  } catch {
    return { ok: false, status: 502, error: `Could not fetch news for ${ticker}` }
  }

  if (!Array.isArray(json)) {
    return { ok: false, status: 502, error: `Unexpected Finnhub response for ${ticker}` }
  }

  const data: FinnhubArticle[] = json
    .filter((item: any) => item?.headline && item?.url && item?.datetime)
    .map((item: any) => ({
      headline: item.headline,
      summary: item.summary || '',
      source: item.source || 'Unknown',
      url: item.url,
      publishedAt: new Date(item.datetime * 1000).toISOString(),
    }))

  return { ok: true, data }
}

export interface FinnhubQuote {
  price: number
  high: number
  low: number
}

export type FetchQuoteResult = { ok: true; data: FinnhubQuote } | { ok: false; status: number; error: string }

// Today's still-forming intraday bar, used to append a synthetic "today"
// row onto the daily close history so signals can be checked before the
// market closes. Finnhub's /quote already tracks the running intraday
// high/low itself, so no candle aggregation is needed here.
export async function fetchQuote(ticker: string): Promise<FetchQuoteResult> {
  if (!process.env.FINNHUB_API_KEY) {
    return { ok: false, status: 500, error: 'FINNHUB_API_KEY is not configured' }
  }

  let json: any
  try {
    const params = new URLSearchParams({ symbol: ticker, token: process.env.FINNHUB_API_KEY })
    const res = await fetch(`https://finnhub.io/api/v1/quote?${params.toString()}`)
    if (!res.ok) throw new Error(`Finnhub returned ${res.status}`)
    json = await res.json()
  } catch {
    return { ok: false, status: 502, error: `Could not fetch quote for ${ticker}` }
  }

  const price = Number(json?.c)
  const high = Number(json?.h)
  const low = Number(json?.l)
  // Finnhub returns all-zero fields for an unrecognised/delisted symbol
  // rather than an error status.
  if (!price || !high || !low) {
    return { ok: false, status: 502, error: `No quote data for ${ticker}` }
  }

  return { ok: true, data: { price, high, low } }
}
