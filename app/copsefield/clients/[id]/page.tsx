'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { BUILDING_TYPES } from '@/lib/copsefieldTaxonomy'

type Client = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

type Building = {
  id: string
  building_code: string
  building_type: string
  name: string
  address: string | null
  city: string | null
}

export default function ClientDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [clientId])

  async function load() {
    const { data } = await supabase
      .from('copsefield_clients')
      .select('id, name, contact_name, email, phone, address, notes')
      .eq('id', clientId)
      .single()
    setClient(data)

    const { data: buildingData } = await supabase
      .from('copsefield_buildings')
      .select('id, building_code, building_type, name, address, city')
      .eq('client_id', clientId)
      .order('name', { ascending: true })
    setBuildings(buildingData || [])

    setLoading(false)
  }

  function set<K extends keyof Client>(key: K, value: Client[K]) {
    setClient((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('copsefield_clients')
      .update({
        name: client.name.trim(),
        contact_name: client.contact_name?.trim() || null,
        email: client.email?.trim() || null,
        phone: client.phone?.trim() || null,
        address: client.address?.trim() || null,
        notes: client.notes?.trim() || null,
      })
      .eq('id', client.id)

    setMessage(error ? error.message : 'Saved.')
    setSaving(false)
  }

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

  if (!client) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Client not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title={client.name} />

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-deck-border bg-deck-surface p-5 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Client details</h2>

            <label className="mt-3 block text-xs font-medium text-deck-body">Name</label>
            <input spellCheck="true"
              type="text"
              value={client.name}
              onChange={(e) => set('name', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Contact name</label>
            <input spellCheck="true"
              type="text"
              value={client.contact_name || ''}
              onChange={(e) => set('contact_name', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Email</label>
            <input
              type="email"
              value={client.email || ''}
              onChange={(e) => set('email', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Phone</label>
            <input
              type="tel"
              value={client.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Address</label>
            <input spellCheck="true"
              type="text"
              value={client.address || ''}
              onChange={(e) => set('address', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-xs font-medium text-deck-body">Notes</label>
            <textarea spellCheck="true"
              value={client.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            {message && <p className="mt-2 text-xs text-deck-dim">{message}</p>}

            <button
              onClick={handleSave}
              disabled={saving || !client.name.trim()}
              className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Buildings ({buildings.length})</h2>
              <Link
                href={`/copsefield/buildings/new?clientId=${client.id}`}
                className="rounded-md bg-copsefield-accent px-3 py-1.5 text-xs font-medium text-deck-bg"
              >
                + Add building
              </Link>
            </div>

            {buildings.length === 0 && <p className="mt-2 text-sm text-deck-dim">No buildings linked to this client yet.</p>}

            {buildings.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildings.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => router.push(`/copsefield/buildings/${b.id}`)}
                        className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-deck-dim">{b.building_code}</td>
                        <td className="px-3 py-2 font-medium text-deck-text">{b.name}</td>
                        <td className="px-3 py-2 text-xs text-deck-dim">{typeLabel(b.building_type)}</td>
                        <td className="px-3 py-2 text-xs text-deck-dim">{[b.address, b.city].filter(Boolean).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
