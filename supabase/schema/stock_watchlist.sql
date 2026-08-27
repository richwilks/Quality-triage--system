-- Per-user watchlist for the stock signal monitor dashboard page
-- (app/dashboard/stock-monitor).
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - it has its own independent
-- Auth system, so a signed-in InspectIQ user's session isn't a valid
-- identity here. user_id is a plain uuid (the InspectIQ user's id, passed
-- in from already-verified server-side code in lib/supabase/watchlistAdmin.ts),
-- not a foreign key to this project's auth.users, and there is no
-- auth.uid()-based RLS policy - only the service-role key (server-side only)
-- ever touches this table. RLS stays enabled with zero permissive policies
-- as a default-deny safety net.

create table if not exists public.stock_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.stock_watchlist enable row level security;
