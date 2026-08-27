import { createClient } from '@supabase/supabase-js'

// The stock-monitor feature's data (stock_watchlist, paper_trades) lives in
// a separate Supabase project from the main app ("Watchlist", not "Quality
// triage") with its own independent Auth system - a signed-in InspectIQ
// user's session isn't a valid identity there. So this always uses the
// service-role key (server-only, never sent to the browser) and every
// caller is responsible for scoping its own queries by the already-verified
// user id from the main app's session (see lib/supabase/server.ts) - there
// is no auth.uid()-based RLS to fall back on here.
export function createWatchlistAdminClient() {
  return createClient(
    process.env.STOCK_MONITOR_SUPABASE_URL as string,
    process.env.STOCK_MONITOR_SUPABASE_SERVICE_ROLE_KEY as string
  )
}
