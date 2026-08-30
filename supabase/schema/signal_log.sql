-- Records every WATCH and CONFIRMED signal fired for a ticker, with the
-- news headlines (if any) included in its alert. Global/ticker-level, not
-- per-user - the signal itself is the same for every watcher, same as
-- stock_news.
--
-- For WATCH signals, the unique constraint below IS the dedupe mechanism -
-- there's no paper_trades row for a near-miss to piggyback on the way
-- confirmed signals already dedupe via that table's cutoffDate logic - so
-- this is an insert-or-skip-on-conflict, same pattern as stock_news.
-- For CONFIRMED signals, this is purely a record (signal_strength +
-- news_snippet in one place); it never gates whether a confirmed alert
-- fires - that's still driven by reconcileAndPersist as before.
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why there's no auth.uid()-based RLS policy here.

create table if not exists public.signal_log (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  signal_date date not null,
  strategy text not null,
  action text not null,
  signal_strength text not null, -- 'watch' or 'confirmed'
  detail text not null,
  news_snippet text,
  created_at timestamptz not null default now(),
  unique (ticker, signal_date, strategy, action, signal_strength)
);

alter table public.signal_log enable row level security;
