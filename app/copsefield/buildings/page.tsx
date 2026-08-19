'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { BUILDING_TYPES } from '@/lib/copsefieldTaxonomy'

type Building = {
  id: string
  building_code: string
  building_type: string
  name: string
  address: string | null
  city: string | null
}

export default function BuildingsPage() {
  const supabase = createClient()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_buildings')
      .select('id, building_code, building_type, name, address, city')
      .order('building_code', { ascending: true })
    setBuildings(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return buildings
    return buildings.filter((b) =>
      [b.building_code, b.name, b.address, b.city].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
    )
  }, [buildings, search])

  function typeLabel(type: string) {
    return BUILDING_TYPES.find((t) => t.value === type)?.label || type
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Buildings" />

        <Link
          href="/copsefield/buildings/new"
          className="mt-4 block w-full rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
        >
          Add a building
        </Link>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, or address..."
          className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        {buildings.length === 0 && <p className="mt-3 text-sm text-deck-dim">No buildings yet.</p>}
        {buildings.length > 0 && filtered.length === 0 && (
          <p className="mt-3 text-sm text-deck-dim">No buildings match &quot;{search}&quot;.</p>
        )}

        <div className="mt-3 space-y-2">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/copsefield/buildings/${b.id}`}
              className="block rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-deck-text">{b.name}</p>
                <span className="rounded-full bg-deck-raised px-2 py-0.5 font-mono text-xs text-deck-dim">{b.building_code}</span>
              </div>
              <p className="mt-1 text-xs text-deck-dim">
                {typeLabel(b.building_type)}
                {b.address ? ` · ${b.address}` : ''}
                {b.city ? `, ${b.city}` : ''}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
