import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'
import { getAccountCash } from '@/lib/trading212'

const MIN_RISK_PCT = 0.1
const MAX_RISK_PCT = 10

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: settings } = await createWatchlistAdminClient()
    .from('trading212_settings')
    .select('enabled, environment, risk_pct, max_total_investment')
    .eq('user_id', user.id)
    .maybeSingle()

  const enabled = !!settings?.enabled
  const environment = settings?.environment || 'demo'
  const riskPct = settings?.risk_pct ?? 2
  const maxTotalInvestment = settings?.max_total_investment ?? null

  // Best-effort - a missing/invalid API key shouldn't fail the whole
  // settings page, just show no balance.
  let cash: number | null = null
  if (enabled) {
    const cashResult = await getAccountCash(environment)
    if (cashResult.ok) cash = cashResult.data.cash
  }

  return NextResponse.json({ enabled, environment, riskPct, maxTotalInvestment, cash })
}

// Turns on/off and configures real-money trading via Trading 212 for this
// user. Switching environment to 'live' additionally requires
// `confirmLive: true` in the body - a server-side guard beyond the
// dashboard's own confirmation step, since this is the one setting here
// that puts real money at risk.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { enabled, environment, riskPct, maxTotalInvestment, confirmLive } = await req.json()

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }
  if (environment !== 'demo' && environment !== 'live') {
    return NextResponse.json({ error: "environment must be 'demo' or 'live'" }, { status: 400 })
  }
  if (environment === 'live' && confirmLive !== true) {
    return NextResponse.json(
      { error: 'Switching to live trading requires explicit confirmation (confirmLive: true)' },
      { status: 400 }
    )
  }
  const parsedRiskPct = Number(riskPct)
  if (!Number.isFinite(parsedRiskPct) || parsedRiskPct < MIN_RISK_PCT || parsedRiskPct > MAX_RISK_PCT) {
    return NextResponse.json({ error: `riskPct must be between ${MIN_RISK_PCT} and ${MAX_RISK_PCT}` }, { status: 400 })
  }

  // Portfolio-wide cap on total open-position cost basis - separate from
  // riskPct's per-trade sizing. null/omitted means no cap.
  let parsedMaxTotalInvestment: number | null = null
  if (maxTotalInvestment !== null && maxTotalInvestment !== undefined && maxTotalInvestment !== '') {
    parsedMaxTotalInvestment = Number(maxTotalInvestment)
    if (!Number.isFinite(parsedMaxTotalInvestment) || parsedMaxTotalInvestment <= 0) {
      return NextResponse.json({ error: 'maxTotalInvestment must be a positive number, or omitted for no cap' }, { status: 400 })
    }
  }

  const { error } = await createWatchlistAdminClient()
    .from('trading212_settings')
    .upsert(
      {
        user_id: user.id,
        enabled,
        environment,
        risk_pct: parsedRiskPct,
        max_total_investment: parsedMaxTotalInvestment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Could not save Trading 212 settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
