// Thin client for Trading 212's public API (docs.trading212.com, currently
// beta) - the real-money counterpart to the paper-trading ledger in
// lib/paperTrading.ts. Follows the same plain-`fetch` + discriminated
// `{ ok: true, data } | { ok: false, error }` result convention as
// lib/yahooFinance.ts and lib/finnhub.ts, rather than pulling in a new HTTP
// client dependency.
//
// CONFIRM BEFORE RELYING ON IN PRODUCTION: Trading 212's own docs are
// internally inconsistent on the auth header (a raw API key vs HTTP Basic
// of "key:secret") and on exactly which response field names come back.
// This implementation uses the raw-key form shown on the orders reference
// page and defensively probes a couple of likely field names rather than
// assuming one - verify both against your own API key during Demo testing
// before ever switching environment to 'live'.

export type Trading212Env = 'demo' | 'live'

function baseUrl(env: Trading212Env): string {
  return env === 'live' ? 'https://live.trading212.com/api/v0' : 'https://demo.trading212.com/api/v0'
}

function apiKey(env: Trading212Env): string | null {
  return (env === 'live' ? process.env.TRADING212_LIVE_API_KEY : process.env.TRADING212_DEMO_API_KEY) || null
}

async function t212Fetch(env: Trading212Env, path: string, init?: RequestInit): Promise<Response> {
  const key = apiKey(env)
  if (!key) throw new Error(`Trading 212 ${env} API key is not configured`)
  return fetch(`${baseUrl(env)}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: key, 'Content-Type': 'application/json' },
  })
}

export type Trading212Result<T> = { ok: true; data: T } | { ok: false; error: string }

export async function getAccountCash(env: Trading212Env): Promise<Trading212Result<{ cash: number }>> {
  try {
    const res = await t212Fetch(env, '/equity/account/cash')
    if (!res.ok) return { ok: false, error: `Trading 212 cash lookup returned ${res.status}` }
    const json = await res.json()
    // Field name isn't confirmed across docs - probe the likely candidates
    // rather than trusting exactly one, but never silently fall back to 0
    // for a number that's about to size a real position.
    const cash = json?.free ?? json?.cash ?? json?.total
    if (typeof cash !== 'number' || !Number.isFinite(cash)) {
      return { ok: false, error: 'Trading 212 cash response did not contain a usable balance' }
    }
    return { ok: true, data: { cash } }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not reach Trading 212' }
  }
}

// Seeded for this app's current watchlist using Trading 212's documented
// "<TICKER>_US_EQ" convention for US-listed equities - a working default
// that needs no extra API call for the common case. Anything not listed
// here falls through to the dynamic lookup below and gets cached in
// trading212_instrument_map once resolved.
const KNOWN_US_TICKERS = [
  'AAPL', 'ADMA', 'AMD', 'AMZN', 'AVGO', 'COST', 'GOOGL', 'META', 'MPC',
  'MSFT', 'MU', 'NBIS', 'NFLX', 'NVDA', 'RIVN', 'SPCX', 'TSLA',
]
const STATIC_INSTRUMENT_MAP: Record<string, string> = Object.fromEntries(
  KNOWN_US_TICKERS.map((t) => [t, `${t}_US_EQ`])
)

export async function getInstrumentCode(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  env: Trading212Env,
  ticker: string
): Promise<string | null> {
  const { data: cached } = await supabase
    .from('trading212_instrument_map')
    .select('instrument_code')
    .eq('ticker', ticker)
    .maybeSingle()
  if (cached?.instrument_code) return cached.instrument_code

  // The instruments-metadata endpoint's exact path isn't confirmed in the
  // docs available at build time - this is a best-effort lookup that
  // degrades to the static map (or null) rather than blocking on it. Any
  // ticker resolved this way is cached so the uncertain call only ever
  // happens once per ticker.
  let resolved: string | null = STATIC_INSTRUMENT_MAP[ticker] || null
  try {
    const res = await t212Fetch(env, '/equity/metadata/instruments')
    if (res.ok) {
      const list = await res.json()
      const match = Array.isArray(list)
        ? list.find((i: any) => i?.ticker === ticker || i?.shortName === ticker)
        : null
      if (match?.ticker) resolved = match.ticker
    }
  } catch {
    // Network/parsing failure here is expected if the path is wrong -
    // the static map (or null) above is still the result.
  }

  if (resolved) {
    await supabase
      .from('trading212_instrument_map')
      .upsert({ ticker, instrument_code: resolved, updated_at: new Date().toISOString() })
  }
  return resolved
}

// Trading 212's market-order endpoint takes a single signed quantity - a
// positive quantity buys, a negative one sells - rather than separate
// buy/sell calls. The endpoint is documented as NOT idempotent: a retried
// request after a timeout can place a second real order. Callers
// (lib/liveTrading.ts) must never blindly retry a failed/ambiguous call -
// log it and let the next scheduled reconciliation pass decide instead.
export async function placeMarketOrder(
  env: Trading212Env,
  instrumentCode: string,
  signedQuantity: number
): Promise<Trading212Result<{ orderId: string; fillPrice: number | null }>> {
  try {
    const res = await t212Fetch(env, '/equity/orders/market', {
      method: 'POST',
      body: JSON.stringify({ ticker: instrumentCode, quantity: signedQuantity }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: json?.message || `Trading 212 order request returned ${res.status}` }
    }
    const orderId = json?.id ?? json?.orderId
    if (!orderId) return { ok: false, error: 'Trading 212 order response did not contain an order id' }
    const fillPrice = typeof json?.fillPrice === 'number' ? json.fillPrice : typeof json?.filledValue === 'number' ? json.filledValue : null
    return { ok: true, data: { orderId: String(orderId), fillPrice } }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not reach Trading 212' }
  }
}
