'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
      <div className="mx-auto max-w-6xl">
        <PageHeader title="My Tasks" />

        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Tickets assigned to me ({tickets.length})
        </h2>
        {tickets.length === 0 && <p className="mt-2 text-sm text-deck-dim">Nothing assigned to you right now.</p>}
        {tickets.length > 0 && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Building</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/copsefield/tickets/${t.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-deck-dim">{t.unique_ref}</td>
                    <td className="px-3 py-2 text-deck-text">{t.asset_category}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{name(t.copsefield_buildings)}</td>
                    <td className="px-3 py-2">
                      {t.priority !== null ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Work orders assigned to me ({workOrders.length})
        </h2>
        {workOrders.length === 0 && <p className="mt-2 text-sm text-deck-dim">Nothing assigned to you right now.</p>}
        {workOrders.length > 0 && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Building</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => router.push(`/copsefield/work-orders/${w.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-medium text-deck-text">{w.title}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{name(w.copsefield_buildings)}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{w.priority}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-deck-raised px-2 py-0.5 text-xs font-medium text-deck-dim">
                        {w.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
