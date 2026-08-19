'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type WorkOrder = {
  id: string
  ticket_id: string | null
  building_id: string
  title: string
  description: string | null
  status: string
  priority: string
  cost_estimate_low: number | null
  cost_estimate_high: number | null
  copsefield_buildings: { name: string } | { name: string }[] | null
}

const STATUS_OPTIONS = ['open', 'in_progress', 'completed', 'cancelled']

export default function WorkOrderDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const workOrderId = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load()
  }, [workOrderId])

  async function load() {
    const { data } = await supabase
      .from('copsefield_work_orders')
      .select('id, ticket_id, building_id, title, description, status, priority, cost_estimate_low, cost_estimate_high, copsefield_buildings(name)')
      .eq('id', workOrderId)
      .single()

    if (data) {
      setWorkOrder(data as unknown as WorkOrder)
      setStatus(data.status)
    }
    setLoading(false)
  }

  function getBuildingName(w: WorkOrder) {
    if (!w.copsefield_buildings) return ''
    return Array.isArray(w.copsefield_buildings) ? w.copsefield_buildings[0]?.name : w.copsefield_buildings.name
  }

  async function handleSave() {
    if (!workOrder) return
    setSaving(true)

    const { error } = await supabase
      .from('copsefield_work_orders')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', workOrder.id)

    if (!error) {
      setSaved(true)
      if (status === 'completed' && workOrder.ticket_id) {
        await supabase.from('copsefield_tickets').update({ status: 'actioned' }).eq('id', workOrder.ticket_id)
      }
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Work order not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={workOrder.title} />
        <p className="mt-1 text-sm text-deck-dim">{getBuildingName(workOrder)}</p>
        {workOrder.ticket_id && (
          <Link href={`/copsefield/tickets/${workOrder.ticket_id}`} className="mt-1 inline-block text-xs text-copsefield-accent underline">
            View source ticket
          </Link>
        )}

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          {workOrder.description && <p className="text-sm text-deck-body">{workOrder.description}</p>}

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-deck-dim">
            <span>
              Priority: <span className="font-medium text-deck-body">{workOrder.priority}</span>
            </span>
            {workOrder.cost_estimate_low !== null && (
              <span>
                · Est. {workOrder.cost_estimate_low}-{workOrder.cost_estimate_high}
              </span>
            )}
          </div>

          <label className="mt-4 block text-sm font-medium text-deck-body">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
