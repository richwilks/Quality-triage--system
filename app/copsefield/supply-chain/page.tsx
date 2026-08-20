'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { CONTRACTOR_TYPES } from '@/lib/copsefieldTaxonomy'

type Contractor = {
  id: string
  type: string
  name: string
  trade: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  active: boolean
}

export default function SupplyChainPage() {
  const supabase = createClient()
  const router = useRouter()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_contractors')
      .select('id, type, name, trade, contact_name, email, phone, active')
      .order('name', { ascending: true })
    setContractors(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contractors
    return contractors.filter((c) =>
      [c.name, c.trade, c.contact_name, c.email, c.phone].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
    )
  }, [contractors, search])

  function typeLabel(type: string) {
    return CONTRACTOR_TYPES.find((t) => t.value === type)?.label || type
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
        <PageHeader title="Supply Chain" />
        <p className="mt-1 text-sm text-deck-dim">Sole traders and businesses Copsefield works with.</p>

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href="/copsefield/supply-chain/new"
            className="rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg lg:shrink-0"
          >
            Add a contact
          </Link>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, trade, contact, email, or phone..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute lg:flex-1"
          />
        </div>

        {contractors.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">
            No contacts yet.{' '}
            <Link href="/copsefield/supply-chain/new" className="font-medium text-copsefield-accent underline">
              Add your first one
            </Link>
            .
          </p>
        )}
        {contractors.length > 0 && filtered.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">No contacts match &quot;{search}&quot;.</p>
        )}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Trade</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/copsefield/supply-chain/${c.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-medium text-deck-text">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{typeLabel(c.type)}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.trade || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.contact_name || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.email || '-'}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{c.phone || '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-deck-raised text-deck-mute'
                        }`}
                      >
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
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
