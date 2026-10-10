-- Per-user Trading 212 live-trading configuration for the stock signal
-- monitor dashboard page (app/dashboard/stock-monitor).
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.
--
-- `enabled` and `environment` default to off/demo so simply having this
-- table (or merging the feature) never starts placing real orders on its
-- own - a user must explicitly opt in from the dashboard, and switching to
-- 'live' additionally requires the API-level confirmLive guard (see
-- app/api/stock-monitor/trading212-settings/route.ts).

create table if not exists public.trading212_settings (
  user_id uuid primary key,
  enabled boolean not null default false,
  environment text not null default 'demo' check (environment in ('demo', 'live')),
  risk_pct numeric not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.trading212_settings enable row level security;
