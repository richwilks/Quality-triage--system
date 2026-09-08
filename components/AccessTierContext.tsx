'use client'

import { createContext, useContext } from 'react'

export type AccessTier = { restricted: boolean }

export const DEFAULT_ACCESS_TIER: AccessTier = { restricted: false }

const AccessTierContext = createContext<AccessTier>(DEFAULT_ACCESS_TIER)

export function useAccessTier() {
  return useContext(AccessTierContext)
}

export function AccessTierProvider({ value, children }: { value: AccessTier; children: React.ReactNode }) {
  return <AccessTierContext.Provider value={value}>{children}</AccessTierContext.Provider>
}
