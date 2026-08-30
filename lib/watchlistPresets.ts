// Curated starter lists for the "bulk add" button on the watchlist card.
// The Nasdaq-100 list reflects well-established mega-cap constituents from
// training knowledge, not a live-verified current weighting (this app has
// no network access to a real index-holdings feed) - exact rank order can
// drift over time, but the largest names rarely change. Both Alphabet share
// classes are included since they're genuinely separate index constituents.
export const NASDAQ100_TOP20_PLUS_QQQ: string[] = [
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'AVGO',
  'META',
  'GOOGL',
  'GOOG',
  'TSLA',
  'COST',
  'NFLX',
  'AMD',
  'PEP',
  'ADBE',
  'LIN',
  'CSCO',
  'TMUS',
  'QCOM',
  'INTU',
  'AMAT',
  'QQQ', // the Nasdaq-100 tracking ETF, not a constituent itself
]

// Same caveat as above: well-established FTSE 100 mega-caps from general
// knowledge, not a live-verified current ranking. ".L" is Yahoo Finance's
// suffix for London Stock Exchange listings - required for fetchDailyCloses
// to resolve these tickers at all.
export const FTSE100_TOP20: string[] = [
  'SHEL.L',
  'AZN.L',
  'HSBA.L',
  'ULVR.L',
  'BP.L',
  'DGE.L',
  'GSK.L',
  'RIO.L',
  'BATS.L',
  'GLEN.L',
  'REL.L',
  'NG.L',
  'RKT.L',
  'BA.L',
  'CPG.L',
  'AV.L',
  'BARC.L',
  'LLOY.L',
  'PRU.L',
  'AAL.L',
]
