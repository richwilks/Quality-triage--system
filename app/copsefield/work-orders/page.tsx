'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Work Orders" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or building..."
          className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute lg:max-w-md"
        />

        {workOrders.length === 0 && <p className="mt-3 text-sm text-deck-dim">No work orders yet - create one from a ticket.</p>}
        {workOrders.length > 0 && filtered.length === 0 && <p className="mt-3 text-sm text-deck-dim">No work orders match &quot;{search}&quot;.</p>}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
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
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => router.push(`/copsefield/work-orders/${w.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-medium text-deck-text">{w.title}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{name(w.copsefield_buildings)}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{w.priority}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[w.status] || STATUS_COLOR.open}`}>
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
