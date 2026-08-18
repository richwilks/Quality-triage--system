'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type WorkOrder = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  fmiq_assets: { name: string } | { name: string }[] | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-blue-500/15 text-blue-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-white/10 text-deck-dim',
}

export default function MyTasksPage() {
  const supabase = createClient()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('fmiq_work_orders')
      .select('id, title, status, priority, due_date, fmiq_assets(name)')
      .eq('assigned_to', user.id)
      .order('due_date', { ascending: true })

    setWorkOrders((data || []) as unknown as WorkOrder[])
    setLoading(false)
  }

  function getAssetName(w: WorkOrder) {
    if (!w.fmiq_assets) return ''
    return Array.isArray(w.fmiq_assets) ? w.fmiq_assets[0]?.name : w.fmiq_assets.name
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
        <p className="mt-1 text-sm text-deck-dim">Everything assigned to you.</p>

        {workOrders.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">Nothing assigned to you right now.</p>
        )}

        <div className="mt-6 space-y-2">
          {workOrders.map((w) => (
            <Link
              key={w.id}
              href={`/fmiq/work-orders/${w.id}`}
              className="block rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <p className="text-xs font-medium text-deck-dim">{getAssetName(w)}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-deck-text">{w.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[w.status] || STATUS_COLOR.open}`}>
                  {STATUS_LABEL[w.status] || w.status}
                </span>
              </div>
              {w.due_date && <p className="mt-1 text-xs text-deck-dim">Due {w.due_date}</p>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
