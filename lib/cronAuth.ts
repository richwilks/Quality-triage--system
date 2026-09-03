import { NextRequest, NextResponse } from 'next/server'

// Vercel auto-attaches `Authorization: Bearer ${CRON_SECRET}` to its own
// Cron invocations when CRON_SECRET is set as a project env var - shared by
// all four stock-monitor cron routes. Logs non-secret diagnostics on a
// rejected request (whether the var/header were present, and their lengths)
// so a mismatch is debuggable from Vercel's function logs without ever
// printing the actual secret value.
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Cron auth rejected', {
      path: req.nextUrl.pathname,
      hasCronSecret: !!cronSecret,
      cronSecretLength: cronSecret?.length ?? 0,
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length ?? 0,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
