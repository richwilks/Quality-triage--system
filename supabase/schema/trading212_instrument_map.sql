-- Cache of plain ticker -> Trading 212 instrument code (e.g. "AAPL" ->
-- "AAPL_US_EQ"), since Trading 212's API addresses instruments by its own
-- suffixed codes rather than plain tickers. Populated lazily by
-- lib/trading212.ts's getInstrumentCode on first use per ticker, rather
-- than synced in bulk - the watchlist is small and codes essentially never
-- change once looked up.
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why this has no foreign key/RLS-enforced ownership column (it's a shared
-- cache, not per-user data).

create table if not exists public.trading212_instrument_map (
  ticker text primary key,
  instrument_code text not null,
  updated_at timestamptz not null default now()
);

alter table public.trading212_instrument_map enable row level security;
