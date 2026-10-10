-- Append-only audit trail of every real-order attempt the live-trading
-- integration makes (lib/liveTrading.ts) - placed, rejected, errored, or
-- skipped (e.g. a risk-% allocation that rounded down to 0 shares). This is
-- what the dashboard shows as "what the bot actually did," distinct from
-- live_trades.sql's open/closed position ledger, so a failed or skipped
-- attempt is never silently invisible.
--
-- IMPORTANT: this table lives in the separate "Watchlist" Supabase project,
-- NOT the main app's "Quality triage" project - see stock_watchlist.sql for
-- why user_id is a plain uuid rather than a foreign key/RLS-enforced column.

create table if not exists public.live_trade_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric,
  trading212_order_id text,
  status text not null check (status in ('placed', 'rejected', 'error', 'skipped')),
  error_message text,
  environment text not null check (environment in ('demo', 'live')),
  created_at timestamptz not null default now()
);

alter table public.live_trade_log enable row level security;
