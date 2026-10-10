-- Real-money trading ledger for the stock signal monitor dashboard page
-- (app/dashboard/stock-monitor) - the live counterpart to paper_trades.sql,
-- populated only when a user has trading212_settings.enabled = true. Same
-- one-position-per-ticker shape and reconciliation logic as paper_trades
-- (see lib/paperTrading.ts's reconcileTicker, reused by lib/liveTrading.ts),
-- but entry_price/exit_price are the ACTUAL fill price Trading 212 returns,
-- not the signal's close price, and quantity/order ids are real.
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.

create table if not exists public.live_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  currency text not null,
  environment text not null check (environment in ('demo', 'live')),
  entry_date date not null,
  entry_price numeric not null,
  entry_strategy text not null,
  entry_detail text,
  quantity numeric not null,
  trading212_order_id text,
  exit_date date,
  exit_price numeric,
  exit_strategy text,
  exit_detail text,
  exit_order_id text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (user_id, ticker, entry_date)
);

alter table public.live_trades enable row level security;
