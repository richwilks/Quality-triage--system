-- Paper-trading ledger for the stock signal monitor dashboard
-- (app/dashboard/stock-monitor). Run this once in the Supabase SQL editor -
-- same as stock_watchlist.sql, there's no migration runner wired up in this
-- repo, so schema changes here are applied by hand.

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  currency text not null,
  entry_date date not null,
  entry_price numeric not null,
  entry_strategy text not null,
  invested_amount numeric not null default 100,
  shares numeric not null,
  exit_date date,
  exit_price numeric,
  exit_strategy text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (user_id, ticker, entry_date)
);

alter table public.paper_trades enable row level security;

create policy "Users manage their own paper trades"
  on public.paper_trades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
