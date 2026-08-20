'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { ASSET_CATEGORIES, TICKET_STATUSES, TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'
import { logWorkOrderEvent } from '@/lib/copsefieldWorkOrders'

type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  component: string | null
  status: string
  priority: number | null
  created_at: string
  building_id: string
  work_order_id: string | null
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

const CLOSED_STATUSES = ['actioned', 'closed', 'deferred']

export default function TicketsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_tickets')
      .select(
        'id, unique_ref, asset_category, component, status, priority, created_at, building_id, work_order_id, copsefield_buildings(name, building_code)'
      )
      .order('created_at', { ascending: false })
    setTickets((data || []) as unknown as Ticket[])
    setLoading(false)
  }

  function getBuilding(t: Ticket) {
    if (!t.copsefield_buildings) return null
    return Array.isArray(t.copsefield_buildings) ? t.copsefield_buildings[0] : t.copsefield_buildings
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (categoryFilter !== 'all' && t.asset_category !== categoryFilter) return false
      if (!q) return true
      const building = getBuilding(t)
      return [t.unique_ref, t.asset_category, t.component, building?.name, building?.building_code]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    })
  }, [tickets, search, statusFilter, categoryFilter])

  async function handleGenerateWorkOrder(t: Ticket, e: React.MouseEvent) {
    e.stopPropagation()
    setBusyId(t.id)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const priorityLabel = 'medium'
    const { data: workOrder, error: insertError } = await supabase
      .from('copsefield_work_orders')
      .insert({
        ticket_id: t.id,
        building_id: t.building_id,
        title: `${t.unique_ref} - ${t.asset_category}`,
        status: 'quote',
        priority: priorityLabel,
        created_by: user?.id,
      })
      .select()
      .single()

    if (!insertError && workOrder) {
      await supabase.from('copsefield_tickets').update({ work_order_id: workOrder.id, status: 'quote' }).eq('id', t.id)
      await logWorkOrderEvent(supabase, workOrder.id, 'created', `Work order raised from ticket ${t.unique_ref}`, user?.id || null)
      load()
    }
    setBusyId(null)
  }

  async function handleClose(t: Ticket, e: React.MouseEvent) {
    e.stopPropagation()
    setBusyId(t.id)
    await supabase.from('copsefield_tickets').update({ status: 'closed' }).eq('id', t.id)
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'closed' } : x)))
    setBusyId(null)
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
        <PageHeader title="Tickets" />

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href="/copsefield/tickets/new"
            className="rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg lg:shrink-0"
          >
            Raise a ticket
          </Link>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, category, or building..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute lg:flex-1"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-2 text-xs text-deck-text lg:w-48"
          >
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-2 text-xs text-deck-text lg:w-52"
          >
            <option value="all">All categories</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {tickets.length === 0 && <p className="mt-4 text-sm text-deck-dim">No tickets yet.</p>}
        {tickets.length > 0 && filtered.length === 0 && <p className="mt-4 text-sm text-deck-dim">No tickets match these filters.</p>}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Category / Component</th>
                  <th className="px-3 py-2 font-medium">Building</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Raised</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const building = getBuilding(t)
                  const closed = CLOSED_STATUSES.includes(t.status)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/copsefield/tickets/${t.id}`)}
                      className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-deck-dim">{t.unique_ref}</td>
                      <td className="px-3 py-2 text-deck-text">
                        {t.asset_category}
                        {t.component ? <span className="text-deck-dim"> · {t.component}</span> : ''}
                      </td>
                      <td className="px-3 py-2 text-xs text-deck-dim">
                        {building ? `${building.name} (${building.building_code})` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {t.priority !== null ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                        ) : (
                          <span className="text-xs text-deck-mute">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-deck-mute">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {t.work_order_id ? (
                            <Link
                              href={`/copsefield/work-orders/${t.work_order_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-medium text-copsefield-accent underline"
                            >
                              View work order
                            </Link>
                          ) : (
                            <button
                              onClick={(e) => handleGenerateWorkOrder(t, e)}
                              disabled={busyId === t.id || closed}
                              className="text-xs font-medium text-copsefield-accent underline disabled:opacity-40"
                            >
                              Generate work order
                            </button>
                          )}
                          {!closed && (
                            <button
                              onClick={(e) => handleClose(t, e)}
                              disabled={busyId === t.id}
                              className="text-xs font-medium text-red-600 disabled:opacity-40"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
