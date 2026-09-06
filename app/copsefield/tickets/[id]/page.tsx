'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import {
  ASSET_TAXONOMY,
  ASSET_CATEGORIES,
  ISSUE_TYPES,
  PRIORITY_SCALE,
  TICKET_STATUSES,
  TICKET_STATUS_COLOR,
  priorityColor,
} from '@/lib/copsefieldTaxonomy'
import { logWorkOrderEvent } from '@/lib/copsefieldWorkOrders'

const CLOSED_STATUSES = ['actioned', 'closed', 'deferred']

type Ticket = {
  id: string
  building_id: string
  unique_ref: string
  asset_category: string
  component: string | null
  location: string | null
  issue_type: string | null
  observation: string | null
  recommendation: string | null
  priority: number | null
  status: string
  planning_allowance_low: number | null
  planning_allowance_high: number | null
  photo_url: string | null
  work_order_id: string | null
  raised_by_type: string
  created_at: string
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

export default function TicketDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isStaff, setIsStaff] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingWorkOrder, setCreatingWorkOrder] = useState(false)
  const [closing, setClosing] = useState(false)

  const [form, setForm] = useState<Partial<Ticket>>({})

  useEffect(() => {
    load()
  }, [ticketId])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('copsefield_role').eq('id', user.id).single()
      setIsStaff(profile?.copsefield_role !== 'owner')
    }

    const { data } = await supabase
      .from('copsefield_tickets')
      .select(
        'id, building_id, unique_ref, asset_category, component, location, issue_type, observation, recommendation, priority, status, planning_allowance_low, planning_allowance_high, photo_url, work_order_id, raised_by_type, created_at, copsefield_buildings(name, building_code)'
      )
      .eq('id', ticketId)
      .single()
    setTicket(data as unknown as Ticket)
    setForm((data as unknown as Ticket) || {})
    setLoading(false)
  }

  function getBuilding(t: Ticket) {
    if (!t.copsefield_buildings) return null
    return Array.isArray(t.copsefield_buildings) ? t.copsefield_buildings[0] : t.copsefield_buildings
  }

  async function handleSave() {
    if (!ticket) return
    setSaving(true)
    await supabase
      .from('copsefield_tickets')
      .update({
        asset_category: form.asset_category,
        component: form.component || null,
        location: form.location || null,
        issue_type: form.issue_type || null,
        observation: form.observation || null,
        recommendation: form.recommendation || null,
        priority: form.priority ?? null,
        status: form.status,
        planning_allowance_low: form.planning_allowance_low ?? null,
        planning_allowance_high: form.planning_allowance_high ?? null,
        last_reviewed_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
    setSaving(false)
    load()
  }

  async function handleCreateWorkOrder() {
    if (!ticket) return
    setCreatingWorkOrder(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const priorityLabel = (ticket.priority || 0) >= 9 ? 'urgent' : (ticket.priority || 0) >= 7 ? 'high' : (ticket.priority || 0) >= 4 ? 'medium' : 'low'

    const { data: workOrder, error: insertError } = await supabase
      .from('copsefield_work_orders')
      .insert({
        ticket_id: ticket.id,
        building_id: ticket.building_id,
        title: `${ticket.unique_ref} - ${ticket.asset_category}`,
        description: [ticket.observation, ticket.recommendation].filter(Boolean).join(' - '),
        status: 'quote',
        priority: priorityLabel,
        cost_estimate_low: ticket.planning_allowance_low,
        cost_estimate_high: ticket.planning_allowance_high,
        created_by: user?.id,
      })
      .select()
      .single()

    if (!insertError && workOrder) {
      await supabase.from('copsefield_tickets').update({ work_order_id: workOrder.id, status: 'quote' }).eq('id', ticket.id)
      await logWorkOrderEvent(supabase, workOrder.id, 'created', `Work order raised from ticket ${ticket.unique_ref}`, user?.id || null)
      router.push(`/copsefield/work-orders/${workOrder.id}`)
    }
    setCreatingWorkOrder(false)
  }

  async function handleCloseTicket() {
    if (!ticket) return
    setClosing(true)
    await supabase.from('copsefield_tickets').update({ status: 'closed' }).eq('id', ticket.id)
    setClosing(false)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Ticket not found.</p>
      </div>
    )
  }

  const building = getBuilding(ticket)
  const components = form.asset_category ? ASSET_TAXONOMY[form.asset_category] || [] : []

  if (!isStaff) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <PageHeader title={ticket.unique_ref} />
          {building && <p className="mt-1 text-sm text-deck-dim">{building.name}</p>}
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[ticket.status]}`}>
            {TICKET_STATUSES.find((s) => s.value === ticket.status)?.label || ticket.status}
          </span>
          <p className="mt-3 text-sm text-deck-text">{ticket.observation}</p>
          {ticket.photo_url && <img src={ticket.photo_url} alt="Ticket" className="mt-3 w-full rounded-md" />}
          <p className="mt-3 text-xs text-deck-mute">
            Raised {new Date(ticket.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title={ticket.unique_ref} />
        {building && (
          <p className="mt-1 text-sm text-deck-dim">
            <Link href={`/copsefield/buildings/${ticket.building_id}`} className="underline">
              {building.name} ({building.building_code})
            </Link>
          </p>
        )}
        <p className="mt-0.5 text-xs text-deck-mute">
          Raised {new Date(ticket.created_at).toLocaleDateString()} · {ticket.raised_by_type === 'owner_portal' ? 'via owner portal' : 'by staff'}
        </p>

        {ticket.photo_url && <img src={ticket.photo_url} alt="Ticket" className="mt-3 w-full rounded-md" />}

        <label className="mt-4 block text-sm font-medium text-deck-body">Status</label>
        {ticket.work_order_id ? (
          <div className="mt-1 flex items-center justify-between rounded-md border border-deck-border bg-deck-raised px-3 py-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[ticket.status]}`}>
              {TICKET_STATUSES.find((s) => s.value === ticket.status)?.label || ticket.status}
            </span>
            <span className="text-xs text-deck-mute">Synced to the linked work order</span>
          </div>
        ) : (
          <select
            value={form.status || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        <label className="mt-3 block text-sm font-medium text-deck-body">Category</label>
        <select
          value={form.asset_category || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, asset_category: e.target.value, component: null }))}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Component</label>
        <select
          value={form.component || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, component: e.target.value }))}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          <option value="">Not specified</option>
          {components.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Location</label>
        <input spellCheck="true"
          type="text"
          value={form.location || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Issue type</label>
        <select
          value={form.issue_type || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, issue_type: e.target.value }))}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          <option value="">Not set</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Observation</label>
        <textarea spellCheck="true"
          value={form.observation || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, observation: e.target.value }))}
          rows={3}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Recommendation</label>
        <textarea spellCheck="true"
          value={form.recommendation || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, recommendation: e.target.value }))}
          rows={3}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        <label className="mt-3 block text-sm font-medium text-deck-body">Priority</label>
        <select
          value={form.priority ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value ? Number(e.target.value) : null }))}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          <option value="">Not set</option>
          {PRIORITY_SCALE.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value} - {p.label}
            </option>
          ))}
        </select>
        {ticket.priority !== null && (
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(ticket.priority)}`}>
            Current: P{ticket.priority}
          </span>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-deck-body">Planning allowance low</label>
            <input
              type="number"
              value={form.planning_allowance_low ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, planning_allowance_low: e.target.value ? Number(e.target.value) : null }))}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deck-body">Planning allowance high</label>
            <input
              type="number"
              value={form.planning_allowance_high ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, planning_allowance_high: e.target.value ? Number(e.target.value) : null }))}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        {ticket.work_order_id ? (
          <Link
            href={`/copsefield/work-orders/${ticket.work_order_id}`}
            className="mt-3 block w-full rounded-md border border-copsefield-accent px-3 py-2 text-center text-sm font-medium text-copsefield-accent"
          >
            View work order
          </Link>
        ) : (
          <button
            onClick={handleCreateWorkOrder}
            disabled={creatingWorkOrder}
            className="mt-3 w-full rounded-md border border-copsefield-accent px-3 py-2 text-sm font-medium text-copsefield-accent disabled:opacity-50"
          >
            {creatingWorkOrder ? 'Creating...' : 'Generate work order'}
          </button>
        )}

        {!CLOSED_STATUSES.includes(ticket.status) && (
          <button
            onClick={handleCloseTicket}
            disabled={closing}
            className="mt-3 w-full rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
          >
            {closing ? 'Closing...' : 'Close ticket'}
          </button>
        )}
      </div>
    </div>
  )
}
