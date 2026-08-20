'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  has_copsefield_access: boolean
  copsefield_role: string
}

type AccessRow = {
  user_id: string
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

export default function CopsefieldSettingsPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [access, setAccess] = useState<AccessRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase
      .from('profiles')
      .select('is_platform_admin, company_admin, copsefield_role')
      .eq('id', user.id)
      .single()

    if (!me?.is_platform_admin && !me?.company_admin) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email, has_copsefield_access, copsefield_role')
      .eq('has_copsefield_access', true)
      .order('copsefield_role')
    setProfiles(profileData || [])

    const { data: accessData } = await supabase
      .from('copsefield_building_access')
      .select('user_id, copsefield_buildings(name, building_code)')
    setAccess((accessData || []) as unknown as AccessRow[])

    setLoading(false)
  }

  function buildingsFor(userId: string) {
    return access
      .filter((a) => a.user_id === userId)
      .map((a) => {
        const b = Array.isArray(a.copsefield_buildings) ? a.copsefield_buildings[0] : a.copsefield_buildings
        return b?.building_code
      })
      .filter(Boolean)
      .join(', ')
  }

  async function handleToggleRole(id: string, currentRole: string) {
    const nextRole = currentRole === 'staff' ? 'owner' : 'staff'
    await supabase.from('profiles').update({ copsefield_role: nextRole }).eq('id', id)
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, copsefield_role: nextRole } : p)))
  }

  async function handleRevoke(id: string) {
    await supabase.from('profiles').update({ has_copsefield_access: false }).eq('id', id)
    setProfiles((prev) => prev.filter((p) => p.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => [p.full_name, p.email].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q)))
  }, [profiles, search])

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

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Copsefield Settings" />
        <p className="mt-1 text-sm text-deck-dim">
          Everyone with Copsefield access - staff can use the full system, owners are restricted to their linked
          buildings (managed from each building's page).
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        <div className="mt-3 space-y-1.5">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-md border border-deck-border bg-deck-surface p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-deck-text">{p.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-deck-dim">{p.email}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.copsefield_role === 'staff' ? 'bg-copsefield-accent/15 text-copsefield-accent' : 'bg-deck-raised text-deck-dim'
                  }`}
                >
                  {p.copsefield_role === 'staff' ? 'Staff' : 'Owner'}
                </span>
              </div>
              {p.copsefield_role === 'owner' && (
                <p className="mt-1 text-xs text-deck-mute">Buildings: {buildingsFor(p.id) || 'none linked yet'}</p>
              )}
              <div className="mt-2 flex gap-3">
                <button onClick={() => handleToggleRole(p.id, p.copsefield_role)} className="text-xs font-medium text-copsefield-accent underline">
                  Make {p.copsefield_role === 'staff' ? 'owner' : 'staff'}
                </button>
                <button onClick={() => handleRevoke(p.id)} className="text-xs font-medium text-red-600">
                  Revoke access
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-deck-dim">No one matches &quot;{search}&quot;.</p>}
        </div>
      </div>
    </div>
  )
}
