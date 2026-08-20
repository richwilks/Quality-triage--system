'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { CONTRACTOR_TYPES, ContractorType, WORK_ORDER_STATUS_COLOR } from '@/lib/copsefieldTaxonomy'

type Contractor = {
  id: string
  type: ContractorType
  name: string
  trade: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  active: boolean
}

type WorkOrder = {
  id: string
  title: string
  status: string
  copsefield_buildings: { name: string } | { name: string }[] | null
}

export default function ContractorDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const contractorId = params.id as string

  const [contractor, setContractor] = useState<Contractor | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [contractorId])

  async function load() {
    const { data } = await supabase
      .from('copsefield_contractors')
      .select('id, type, name, trade, contact_name, email, phone, address, notes, active')
      .eq('id', contractorId)
      .single()
    setContractor(data)

    const { data: woData } = await supabase
      .from('copsefield_work_orders')
      .select('id, title, status, copsefield_buildings(name)')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false })
    setWorkOrders((woData || []) as unknown as WorkOrder[])

    setLoading(false)
  }

  function set<K extends keyof Contractor>(key: K, value: Contractor[K]) {
    setContractor((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!contractor) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('copsefield_contractors')
      .update({
        type: contractor.type,
        name: contractor.name.trim(),
        trade: contractor.trade?.trim() || null,
        contact_name: contractor.contact_name?.trim() || null,
        email: contractor.email?.trim() || null,
        phone: contractor.phone?.trim() || null,
        address: contractor.address?.trim() || null,
        notes: contractor.notes?.trim() || null,
        active: contractor.active,
      })
      .eq('id', contractor.id)

    setMessage(error ? error.message : 'Saved.')
    setSaving(false)
  }

  function buildingName(w: WorkOrder) {
    if (!w.copsefield_buildings) return ''
    return Array.isArray(w.copsefield_buildings) ? w.copsefield_buildings[0]?.name : w.copsefield_buildings.name
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!contractor) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Contact not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={contractor.name} />

        <label className="mt-4 block text-sm font-medium text-deck-body">Type</label>
        <select
          value={contractor.type}
          onChange={(e) => set('type', e.target.value as ContractorType)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          {CONTRACTOR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Name</label>
        <input
          type="text"
          value={contractor.name}
          onChange={(e) => set('name', e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Trade</label>
        <input
          type="text"
          value={contractor.trade || ''}
          onChange={(e) => set('trade', e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Contact name</label>
        <input
          type="text"
          value={contractor.contact_name || ''}
          onChange={(e) => set('contact_name', e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-deck-body">Email</label>
            <input
              type="email"
              value={contractor.email || ''}
              onChange={(e) => set('email', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deck-body">Phone</label>
            <input
              type="tel"
              value={contractor.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />
          </div>
        </div>

        <label className="mt-3 block text-sm font-medium text-deck-body">Address</label>
        <input
          type="text"
          value={contractor.address || ''}
          onChange={(e) => set('address', e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Notes</label>
        <textarea
          value={contractor.notes || ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-deck-body">
          <input type="checkbox" checked={contractor.active} onChange={(e) => set('active', e.target.checked)} />
          Active
        </label>

        {message && <p className="mt-2 text-xs text-deck-dim">{message}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !contractor.name.trim()}
          className="mt-5 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">Work history ({workOrders.length})</h2>
        {workOrders.length === 0 && <p className="mt-2 text-sm text-deck-dim">No work orders assigned to them yet.</p>}
        {workOrders.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {workOrders.map((w) => (
              <div
                key={w.id}
                onClick={() => router.push(`/copsefield/work-orders/${w.id}`)}
                className="flex cursor-pointer items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2 hover:bg-deck-raised"
              >
                <div>
                  <p className="text-sm font-medium text-deck-text">{w.title}</p>
                  <p className="text-xs text-deck-dim">{buildingName(w)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORK_ORDER_STATUS_COLOR[w.status] || 'bg-deck-raised text-deck-mute'}`}>
                  {w.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
