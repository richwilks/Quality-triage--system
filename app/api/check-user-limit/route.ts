import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { RESTRICTED_USER_LIMIT } from '@/lib/accessTierConstants'

// Called from the signup form before auth.signUp() actually creates a
// profile. Needs the service-role key (not the signed-out visitor's anon
// session) to read company_settings/profiles ahead of that account existing.
export async function POST(req: NextRequest) {
  try {
    const { companyName }: { companyName: string } = await req.json()
    if (!companyName?.trim()) {
      return NextResponse.json({ allowed: true })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    const { data: settings } = await supabaseAdmin
      .from('company_settings')
      .select('feature_restricted_access')
      .ilike('company_name', companyName.trim())
      .maybeSingle()

    if (!settings?.feature_restricted_access) {
      return NextResponse.json({ allowed: true })
    }

    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('company_name', companyName.trim())

    const current = count || 0
    if (current >= RESTRICTED_USER_LIMIT) {
      return NextResponse.json({
        allowed: false,
        reason: `${companyName.trim()} has reached its limit of ${RESTRICTED_USER_LIMIT} users on this plan. Ask your company admin to free up a seat, or contact us to upgrade.`,
      })
    }

    return NextResponse.json({ allowed: true, current, limit: RESTRICTED_USER_LIMIT })
  } catch (err: any) {
    // Fail open - a broken check shouldn't block every signup on the app.
    return NextResponse.json({ allowed: true })
  }
}
