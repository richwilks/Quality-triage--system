-- Web Push (VAPID) subscriptions for the stock signal monitor dashboard
-- page (app/dashboard/stock-monitor). One row per device a user has
-- enabled push alerts on.
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
