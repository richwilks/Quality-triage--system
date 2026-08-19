import { createClient } from '@/lib/supabase/server'
import type { Branding } from '@/components/BrandingContext'

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const EMPTY: { branding: Branding; accentColor: string | null } = {
  branding: { whiteLabelEnabled: false, logoUrl: null, companyName: null, hideDefaultBrand: false },
  accentColor: null,
}

// InspectIQ and FMIQ are two separate products sharing only the same login
// and the defect knowledge base - a company can be approved for white-label
// on one without the other, with its own logo/colour, so each product's
// layout loads its own branding independently rather than sharing one gate.
export async function loadBranding(
  product: 'inspectiq' | 'fmiq'
): Promise<{ branding: Branding; accentColor: string | null }> {
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
    .select(
      'feature_branded_reports, logo_url, accent_color, feature_hide_inspectiq_brand, fmiq_white_label_enabled, fmiq_logo_url, fmiq_accent_color'
    )
    .eq('company_name', profile.company_name)
    .maybeSingle()

  // feature_branded_reports is the platform admin's actual on/off approval for
  // InspectIQ white-label (toggled on the Platform Admin > Branding tab);
  // fmiq_white_label_enabled is the equivalent, independent approval for FMIQ.
  const whiteLabelEnabled =
    product === 'inspectiq' ? !!settings?.feature_branded_reports : !!settings?.fmiq_white_label_enabled

  const rawLogo = product === 'inspectiq' ? settings?.logo_url : settings?.fmiq_logo_url
  const rawColor = product === 'inspectiq' ? settings?.accent_color : settings?.fmiq_accent_color

  const accentColor = whiteLabelEnabled && rawColor && HEX_COLOR.test(rawColor) ? rawColor : null

  return {
    branding: {
      whiteLabelEnabled,
      logoUrl: whiteLabelEnabled ? rawLogo || null : null,
      companyName: profile.company_name,
      hideDefaultBrand: whiteLabelEnabled && !!settings?.feature_hide_inspectiq_brand,
    },
    accentColor,
  }
}
