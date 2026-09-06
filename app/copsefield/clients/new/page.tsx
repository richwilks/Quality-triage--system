'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

export default function NewClientPage() {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: client, error: insertError } = await supabase
      .from('copsefield_clients')
      .insert({
        name: name.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (insertError || !client) {
      setError(insertError?.message || 'Could not save client')
      setSaving(false)
      return
    }

    router.push(`/copsefield/clients/${client.id}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Add a client" />

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-5 shadow-sm">
          <label className="block text-sm font-medium text-deck-body">Client / company name</label>
          <input spellCheck="true"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Harbourview Strata Corporation"
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-deck-body">Contact name</label>
              <input spellCheck="true"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Address</label>
              <input spellCheck="true"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-deck-body">Notes</label>
          <textarea spellCheck="true"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="mt-5 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50 lg:w-auto lg:px-8"
        >
          {saving ? 'Saving...' : 'Save client'}
        </button>
      </div>
    </div>
  )
}
