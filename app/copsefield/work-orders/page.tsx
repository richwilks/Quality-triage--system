'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type WorkOrder = {
  id: string
  title: string
  status: string
  priority: string
  copsefield_buildings: { name: string } | { name: string }[] | null
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-deck-raised text-deck-mute',
}

export default function WorkOrdersPage() {
  const supabase = createClient()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_work_orders')
      .select('id, title, status, priority, copsefield_buildings(name)')
      .order('created_at', { ascending: false })
    setWorkOrders((data || []) as unknown as WorkOrder[])
    setLoading(false)
  }

  function name(rel: WorkOrder['copsefield_buildings']) {
    if (!rel) return ''
    return Array.isArray(rel) ? rel[0]?.name : rel.name
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return workOrders
    return workOrders.filter((w) => [w.title, name(w.copsefield_buildings)].filter(Boolean).some((v) => v!.toLowerCase().includes(q)))
  }, [workOrders, search])

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
        <PageHeader title="Work Orders" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or building..."
          className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        {workOrders.length === 0 && <p className="mt-3 text-sm text-deck-dim">No work orders yet - create one from a ticket.</p>}
        {workOrders.length > 0 && filtered.length === 0 && <p className="mt-3 text-sm text-deck-dim">No work orders match &quot;{search}&quot;.</p>}

        <div className="mt-3 space-y-1.5">
          {filtered.map((w) => (
            <Link
              key={w.id}
              href={`/copsefield/work-orders/${w.id}`}
              className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
            >
              <div>
                <p className="text-sm text-deck-text">{w.title}</p>
                <p className="text-xs text-deck-dim">{name(w.copsefield_buildings)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[w.status] || STATUS_COLOR.open}`}>
                {w.status.replace('_', ' ')}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
