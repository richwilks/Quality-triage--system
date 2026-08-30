-- Paper-trading ledger for the stock signal monitor dashboard page
-- (app/dashboard/stock-monitor).
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  currency text not null,
  entry_date date not null,
  entry_price numeric not null,
  entry_strategy text not null,
  entry_detail text,
  invested_amount numeric not null default 100,
  shares numeric not null,
  exit_date date,
  exit_price numeric,
  exit_strategy text,
  exit_detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (user_id, ticker, entry_date)
);

alter table public.paper_trades enable row level security;
