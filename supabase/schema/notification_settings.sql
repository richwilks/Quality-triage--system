-- Per-user email alert preferences for the stock signal monitor dashboard
-- page (app/dashboard/stock-monitor).
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.

create table if not exists public.notification_settings (
  user_id uuid primary key,
  email text not null,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
