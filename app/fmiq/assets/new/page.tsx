'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

export default function NewAssetPage() {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give the asset a name.')
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
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !asset) {
      setError(`Could not create the asset: ${insertError?.message || 'unknown error'}`)
      setSaving(false)
      return
    }

    router.push(`/fmiq/assets/${asset.id}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="New Asset" />

        <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-deck-body">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside House, or Chiller Unit 3"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 14 Riverside Road, or Plant Room B"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything useful for whoever's maintaining this"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create asset'}
          </button>
        </div>
      </div>
    </div>
  )
}
