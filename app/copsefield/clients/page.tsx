'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Client = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  building_count?: number
}

export default function ClientsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_clients')
      .select('id, name, contact_name, email, phone')
      .order('name', { ascending: true })

    const { data: buildingData } = await supabase.from('copsefield_buildings').select('client_id')
    const counts: Record<string, number> = {}
    for (const b of buildingData || []) {
      if (b.client_id) counts[b.client_id] = (counts[b.client_id] || 0) + 1
    }

    setClients((data || []).map((c) => ({ ...c, building_count: counts[c.id] || 0 })))
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => [c.name, c.contact_name, c.email, c.phone].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q)))
  }, [clients, search])

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
        <PageHeader title="Clients" />
        <p className="mt-1 text-sm text-deck-dim">The property owners and management companies Copsefield works for. Buildings belong to a client.</p>

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href="/copsefield/clients/new"
            className="rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg lg:shrink-0"
          >
            Add a client
          </Link>
          <input spellCheck="true"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact, email, or phone..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute lg:flex-1"
          />
        </div>

        {clients.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">
            No clients yet.{' '}
            <Link href="/copsefield/clients/new" className="font-medium text-copsefield-accent underline">
              Add your first one
            </Link>
            .
          </p>
        )}
        {clients.length > 0 && filtered.length === 0 && <p className="mt-4 text-sm text-deck-dim">No clients match &quot;{search}&quot;.</p>}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Buildings</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/copsefield/clients/${c.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-medium text-deck-text">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.contact_name || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.email || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.phone || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.building_count}</td>
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
