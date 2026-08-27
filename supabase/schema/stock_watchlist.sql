-- Per-user watchlist for the stock signal monitor dashboard page
-- (app/dashboard/stock-monitor). Run this once in the Supabase SQL editor -
-- there's no migration runner wired up in this repo, so schema changes here
-- are applied by hand.

create table if not exists public.stock_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.stock_watchlist enable row level security;

create policy "Users manage their own watchlist"
  on public.stock_watchlist
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
