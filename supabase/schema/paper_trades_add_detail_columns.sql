-- Adds the human-readable "why this signal fired" text (already computed
-- by every signal strategy in lib/stockSignals.ts/lib/newsSignal.ts, but
-- previously discarded before reaching the ledger) to each trade record.
-- Nullable since existing rows predate this column.

alter table public.paper_trades add column if not exists entry_detail text;
alter table public.paper_trades add column if not exists exit_detail text;
