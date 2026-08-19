'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'

type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  status: string
  priority: number | null
  copsefield_buildings: { name: string } | { name: string }[] | null
}

type WorkOrder = {
  id: string
  title: string
  status: string
  priority: string
  copsefield_buildings: { name: string } | { name: string }[] | null
}

export default function MyTasksPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: ticketData } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, status, priority, copsefield_buildings(name)')
      .eq('assigned_to', user.id)
      .not('status', 'in', '(actioned,deferred)')
      .order('priority', { ascending: false })
    setTickets((ticketData || []) as unknown as Ticket[])

    const { data: workOrderData } = await supabase
      .from('copsefield_work_orders')
      .select('id, title, status, priority, copsefield_buildings(name)')
      .eq('assigned_to', user.id)
      .not('status', 'in', '(completed,cancelled)')
    setWorkOrders((workOrderData || []) as unknown as WorkOrder[])

    setLoading(false)
  }

  function name(rel: { name: string } | { name: string }[] | null) {
    if (!rel) return ''
    return Array.isArray(rel) ? rel[0]?.name : rel.name
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
      <div className="mx-auto max-w-md">
        <PageHeader title="My Tasks" />

        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Tickets assigned to me ({tickets.length})
        </h2>
        {tickets.length === 0 && <p className="mt-2 text-sm text-deck-dim">Nothing assigned to you right now.</p>}
        <div className="mt-2 space-y-1.5">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/copsefield/tickets/${t.id}`}
              className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
            >
              <div>
                <p className="text-xs font-mono text-deck-dim">{t.unique_ref}</p>
                <p className="text-sm text-deck-text">
                  {t.asset_category} · {name(t.copsefield_buildings)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {t.priority !== null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Work orders assigned to me ({workOrders.length})
        </h2>
        {workOrders.length === 0 && <p className="mt-2 text-sm text-deck-dim">Nothing assigned to you right now.</p>}
        <div className="mt-2 space-y-1.5">
          {workOrders.map((w) => (
            <Link
              key={w.id}
              href={`/copsefield/work-orders/${w.id}`}
              className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
            >
              <div>
                <p className="text-sm text-deck-text">{w.title}</p>
                <p className="text-xs text-deck-dim">{name(w.copsefield_buildings)}</p>
              </div>
              <span className="rounded-full bg-deck-raised px-2 py-0.5 text-xs font-medium text-deck-dim">{w.priority}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
