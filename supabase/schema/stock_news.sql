-- News headlines + LLM-scored sentiment for the stock signal monitor.
-- Lives in the "Watchlist" Supabase project, same no-FK/service-role-only/
-- no-user_id pattern as signal_params - shared across every user watching
-- a ticker, not per-user (see stock_watchlist.sql for the reasoning on
-- why there's no auth.uid()-based RLS in this project).

create table if not exists public.stock_news (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  headline text not null,
  summary text,
  source text,
  url text not null,
  published_at timestamptz not null,
  sentiment_score numeric not null,
  fetched_at timestamptz not null default now(),
  unique (ticker, url)
);

alter table public.stock_news enable row level security;
