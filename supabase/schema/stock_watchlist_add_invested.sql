-- Lets a user mark a watchlisted ticker as one they've actually put real
-- money into, distinct from the existing confidence_mode flag (which only
-- controls alerting style). Purely informational/UI - doesn't change
-- signal computation, alerting, or the paper-trading ledger. Defaults to
-- false so every existing row (and every newly added ticker) starts as
-- "just watching" until explicitly marked otherwise.

alter table public.stock_watchlist add column if not exists invested boolean not null default false;
