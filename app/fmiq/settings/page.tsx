'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type BrandingRow = {
  white_label_enabled: boolean
  logo_url: string | null
  accent_color: string | null
  feature_branded_reports: boolean
}

export default function FMIQSettingsPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')

  const [branding, setBranding] = useState<BrandingRow | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [accentColor, setAccentColor] = useState('#B45309')
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_admin, company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_admin || !profile.company_name) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    setCompanyName(profile.company_name)

    const { data: brandingData } = await supabase
      .from('company_settings')
      .select('white_label_enabled, logo_url, accent_color, feature_branded_reports')
      .ilike('company_name', profile.company_name)
      .maybeSingle()

    if (brandingData) {
      setBranding(brandingData)
      if (brandingData.accent_color) setAccentColor(brandingData.accent_color)
    }

    setLoading(false)
  }

  async function handleSaveBranding() {
    setSavingBranding(true)
    setBrandingMessage(null)

    let logoUrl = branding?.logo_url || null

    if (logoFile) {
      const path = `${companyName}/${Date.now()}-${logoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('company-branding')
        .upload(path, logoFile)

      if (uploadError) {
        setBrandingMessage(`Logo upload failed: ${uploadError.message}`)
        setSavingBranding(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('company-branding').getPublicUrl(path)
      logoUrl = publicUrl
    }

    const { error } = await supabase.rpc('update_company_branding', {
      target_company: companyName,
      logo: logoUrl,
      color: accentColor,
    })

    if (error) {
      setBrandingMessage(`Could not save: ${error.message}`)
    } else {
      setBrandingMessage('Branding saved.')
      setBranding((prev) => ({
        white_label_enabled: prev?.white_label_enabled || false,
        feature_branded_reports: prev?.feature_branded_reports || false,
        logo_url: logoUrl,
        accent_color: accentColor,
      }))
      setLogoFile(null)
    }

    setSavingBranding(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">You don't have access to this page.</p>
      </div>
    )
  }

  const brandingUnlocked = branding?.feature_branded_reports || branding?.white_label_enabled

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="FMIQ Settings" />
        <p className="mt-1 text-sm text-deck-dim">{companyName} - white-label branding.</p>

        {!brandingUnlocked && (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <p className="text-sm font-medium text-deck-body">White-label branding isn't enabled yet</p>
            <p className="mt-1 text-xs text-deck-dim">
              This is a platform-level setting turned on per company, separate from being a company admin.
              Ask whoever manages your InspectIQ/FMIQ platform account to enable it, then this page will let
              you set your logo and accent colour.
            </p>
          </div>
        )}

        {brandingUnlocked && (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <p className="text-sm font-medium text-deck-body">Branding</p>
            <p className="mt-1 text-xs text-deck-dim">
              This logo and colour apply across both InspectIQ and FMIQ.
            </p>

            {branding?.logo_url && (
              <img
                src={branding.logo_url}
                alt="Current logo"
                className="mt-3 h-12 w-auto rounded-md border border-deck-border object-contain p-2"
              />
            )}

            <label className="mt-3 block text-xs font-medium text-deck-body">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Accent colour</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-9 rounded-md border border-deck-border"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
            </div>

            {brandingMessage && (
              <p className="mt-2 text-sm text-deck-body">{brandingMessage}</p>
            )}

            <button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              className="mt-3 w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {savingBranding ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
