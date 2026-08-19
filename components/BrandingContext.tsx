'use client'

import { createContext, useContext } from 'react'

export type Branding = {
  whiteLabelEnabled: boolean
  logoUrl: string | null
  companyName: string | null
  hideDefaultBrand: boolean
}

export const DEFAULT_BRANDING: Branding = {
  whiteLabelEnabled: false,
  logoUrl: null,
  companyName: null,
  hideDefaultBrand: false,
}

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING)

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandingProvider({ value, children }: { value: Branding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}
