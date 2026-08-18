'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed use' },
]

export default function NewAssetPage() {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [propertyType, setPropertyType] = useState('residential')
  const [jurisdiction, setJurisdiction] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give the property a name.')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_name) {
      setError('Your account has no company set - contact an admin.')
      setSaving(false)
      return
    }

    const { data: asset, error: insertError } = await supabase
      .from('fmiq_assets')
      .insert({
        company_name: profile.company_name,
        name: name.trim(),
        location: location.trim() || null,
        property_type: propertyType,
        jurisdiction: jurisdiction.trim() || null,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !asset) {
      setError(`Could not create the property: ${insertError?.message || 'unknown error'}`)
      setSaving(false)
      return
    }

    router.push(`/fmiq/assets/${asset.id}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="New Property" />

        <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-deck-body">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside House"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Address</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 14 Riverside Road, London"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Property type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Jurisdiction</label>
            <input
              type="text"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              placeholder="e.g. UK, or England & Wales"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
            <p className="mt-1 text-xs text-deck-dim">
              Matched against the Regulations Library to bring in the right local laws during inspections.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything useful for whoever's inspecting or maintaining this"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create property'}
          </button>
        </div>
      </div>
    </div>
  )
}
