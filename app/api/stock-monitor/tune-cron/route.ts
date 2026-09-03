import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cronAuth'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { tuneTicker, upsertSignalParams } from '@/lib/paramTuning'

export const maxDuration = 300

// Weekly Vercel Cron job (see vercel.json) that re-tunes signal parameters
// per ticker against the paper-trading simulation, across everyone's
// watchlists. Weekly rather than daily - parameters this coarse shouldn't
// meaningfully change day to day, and daily re-tuning would just overreact
// to noise.
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const supabaseAdmin = createWatchlistAdminClient()
  const { data: watchlistRows, error } = await supabaseAdmin.from('stock_watchlist').select('ticker')

  if (error) {
    return NextResponse.json({ error: 'Could not load watchlists' }, { status: 500 })
  }

  const tickers = [...new Set((watchlistRows || []).map((row) => row.ticker))]
  const summary: { ticker: string; isTuned: boolean; backtestReturnPct?: number; validatedReturnPct?: number; error?: string }[] = []

  for (const ticker of tickers) {
    const result = await tuneTicker(ticker)
    if (!result) {
      summary.push({ ticker, isTuned: false, error: 'Not enough history to tune' })
      continue
    }
    await upsertSignalParams(ticker, result)
    summary.push({
      ticker,
      isTuned: result.isTuned,
      backtestReturnPct: result.backtestReturnPct,
      validatedReturnPct: result.validatedReturnPct,
    })
  }

  return NextResponse.json({ summary })
}
