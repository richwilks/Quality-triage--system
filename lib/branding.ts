import { createClient } from '@/lib/supabase/server'
import type { Branding } from '@/components/BrandingContext'

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const EMPTY: { branding: Branding; accentColor: string | null } = {
  branding: { whiteLabelEnabled: false, logoUrl: null, companyName: null, hideDefaultBrand: false },
  accentColor: null,
}

// Loaded once per layout render (server-side, before paint) so white-label
// branding - logo, company name, accent colour - applies from first paint
// with no flash of default InspectIQ/FMIQ branding.
export async function loadBranding(): Promise<{ branding: Branding; accentColor: string | null }> {
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
    .select('white_label_enabled, logo_url, accent_color, feature_hide_inspectiq_brand')
    .eq('company_name', profile.company_name)
    .maybeSingle()

  const whiteLabelEnabled = !!settings?.white_label_enabled
  const accentColor = whiteLabelEnabled && settings?.accent_color && HEX_COLOR.test(settings.accent_color)
    ? settings.accent_color
    : null

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
