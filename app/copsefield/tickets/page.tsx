'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { ASSET_CATEGORIES, TICKET_STATUSES, TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'

type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  component: string | null
  status: string
  priority: number | null
  created_at: string
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

export default function TicketsPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, component, status, priority, created_at, copsefield_buildings(name, building_code)')
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

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Tickets" />

        <Link
          href="/copsefield/tickets/new"
          className="mt-4 block w-full rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
        >
          Raise a ticket
        </Link>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference, category, or building..."
          className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        <div className="mt-2 flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-xs text-deck-text"
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
            className="flex-1 rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-xs text-deck-text"
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

        <div className="mt-3 space-y-1.5">
          {filtered.map((t) => {
            const building = getBuilding(t)
            return (
              <Link
                key={t.id}
                href={`/copsefield/tickets/${t.id}`}
                className="block rounded-md border border-deck-border bg-deck-surface px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-deck-dim">{t.unique_ref}</p>
                  <div className="flex items-center gap-1.5">
                    {t.priority !== null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-deck-text">
                  {t.asset_category}
                  {t.component ? ` · ${t.component}` : ''}
                </p>
                {building && (
                  <p className="mt-0.5 text-xs text-deck-dim">
                    {building.name} ({building.building_code})
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
