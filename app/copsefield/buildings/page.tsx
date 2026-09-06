'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  copsefield_clients: { name: string } | { name: string }[] | null
}

export default function BuildingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_buildings')
      .select('id, building_code, building_type, name, address, city, copsefield_clients(name)')
      .order('building_code', { ascending: true })
    setBuildings((data || []) as unknown as Building[])
    setLoading(false)
  }

  function clientName(b: Building) {
    if (!b.copsefield_clients) return null
    return Array.isArray(b.copsefield_clients) ? b.copsefield_clients[0]?.name : b.copsefield_clients.name
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return buildings
    return buildings.filter((b) =>
      [b.building_code, b.name, b.address, b.city, clientName(b)].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
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
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Buildings" />

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href="/copsefield/buildings/new"
            className="rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg lg:shrink-0"
          >
            Add a building
          </Link>
          <input spellCheck="true"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, or address..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute lg:flex-1"
          />
        </div>

        {buildings.length === 0 && <p className="mt-4 text-sm text-deck-dim">No buildings yet.</p>}
        {buildings.length > 0 && filtered.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">No buildings match &quot;{search}&quot;.</p>
        )}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/copsefield/buildings/${b.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-deck-dim">{b.building_code}</td>
                    <td className="px-3 py-2 font-medium text-deck-text">{b.name}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{clientName(b) || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{typeLabel(b.building_type)}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">
                      {[b.address, b.city].filter(Boolean).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
