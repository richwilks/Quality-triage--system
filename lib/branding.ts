import { createClient } from '@/lib/supabase/server'
import type { Branding } from '@/components/BrandingContext'

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const EMPTY: { branding: Branding; accentColor: string | null } = {
  branding: { whiteLabelEnabled: false, logoUrl: null, companyName: null, hideDefaultBrand: false },
  accentColor: null,
}

// InspectIQ is the only product with white-label branding - it's used by
// many different companies. Copsefield Group is a private, single-company
// system with a fixed brand, so it doesn't go through this at all.
export async function loadBranding(product: 'inspectiq'): Promise<{ branding: Branding; accentColor: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', user.id)
    .single()

  if (!profile?.company_name) return EMPTY

  const { data: settings } = await supabase
    .from('company_settings')
    .select('feature_branded_reports, logo_url, accent_color, feature_hide_inspectiq_brand')
    .eq('company_name', profile.company_name)
    .maybeSingle()

  const whiteLabelEnabled = !!settings?.feature_branded_reports
  const accentColor = whiteLabelEnabled && settings?.accent_color && HEX_COLOR.test(settings.accent_color) ? settings.accent_color : null

  return {
    branding: {
      whiteLabelEnabled,
      logoUrl: whiteLabelEnabled ? settings?.logo_url || null : null,
      companyName: profile.company_name,
      hideDefaultBrand: whiteLabelEnabled && !!settings?.feature_hide_inspectiq_brand,
    },
    accentColor,
  }
}
