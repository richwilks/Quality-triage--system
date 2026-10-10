-- Portfolio-wide cap on total open-position cost basis for Trading 212
-- live trading (lib/liveTrading.ts's capQuantityForInvestmentLimit) - a
-- hard ceiling across every ticker at once, separate from risk_pct's
-- per-trade sizing. Null means uncapped, matching every pre-existing row.

alter table public.trading212_settings
  add column if not exists max_total_investment numeric;
