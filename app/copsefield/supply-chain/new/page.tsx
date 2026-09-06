'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { CONTRACTOR_TYPES, ContractorType } from '@/lib/copsefieldTaxonomy'

export default function NewContractorPage() {
  const supabase = createClient()
  const router = useRouter()

  const [type, setType] = useState<ContractorType>('business')
  const [name, setName] = useState('')
  const [trade, setTrade] = useState('')
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

    const { data: contractor, error: insertError } = await supabase
      .from('copsefield_contractors')
      .insert({
        type,
        name: name.trim(),
        trade: trade.trim() || null,
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (insertError || !contractor) {
      setError(insertError?.message || 'Could not save contact')
      setSaving(false)
      return
    }

    router.push(`/copsefield/supply-chain/${contractor.id}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Add a supply chain contact" />

        <label className="mt-4 block text-sm font-medium text-deck-body">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ContractorType)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          {CONTRACTOR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Name</label>
        <input spellCheck="true"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kelowna Roofing Ltd."
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Trade</label>
        <input spellCheck="true"
          type="text"
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="e.g. Roofing, Electrical, Landscaping"
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Contact name</label>
        <input spellCheck="true"
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
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
        </div>

        <label className="mt-3 block text-sm font-medium text-deck-body">Address</label>
        <input spellCheck="true"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Notes (optional)</label>
        <textarea spellCheck="true"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Insurance details, WCB, certifications, rates, anything worth remembering"
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="mt-5 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save contact'}
        </button>
      </div>
    </div>
  )
}
