-- Backtest-tuned signal parameters, per ticker, for the stock signal
-- monitor. Lives in the same "Watchlist" Supabase project as
-- stock_watchlist/paper_trades - same no-FK, service-role-only reasoning
-- (see stock_watchlist.sql). Shared across every user watching a ticker,
-- not per-user - there's no user_id column.

create table if not exists public.signal_params (
  ticker text primary key,
  sma_short int not null,
  sma_long int not null,
  rsi_oversold numeric not null,
  rsi_overbought numeric not null,
  adx_threshold numeric not null,
  is_tuned boolean not null default false,
  backtest_return_pct numeric not null,
  validated_return_pct numeric not null,
  tuned_at timestamptz not null default now()
);

alter table public.signal_params enable row level security;
