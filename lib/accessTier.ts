import { createClient } from '@/lib/supabase/server'

export type AccessTier = {
  restricted: boolean
}

const DEFAULT_TIER: AccessTier = { restricted: false }

// A restricted-tier company is capped at RESTRICTED_USER_LIMIT users (enforced
// at signup - see app/api/check-user-limit) and its nav is trimmed to the
// plan's feature set (see lib/quickLinks.ts) - everything else in the app
// still works the same for them, this only affects what's shown/offered.
export async function loadAccessTier(): Promise<AccessTier> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return DEFAULT_TIER

  const { data: profile } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
  if (!profile?.company_name) return DEFAULT_TIER

  const { data: settings } = await supabase
    .from('company_settings')
    .select('feature_restricted_access')
    .ilike('company_name', profile.company_name)
    .maybeSingle()

  return { restricted: !!settings?.feature_restricted_access }
}
