'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type WorkOrder = {
  id: string
  asset_id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  is_recurring: boolean
  recurrence_interval: string | null
  completed_notes: string | null
  assigned_to: string | null
  fmiq_assets: { name: string } | { name: string }[] | null
}

const STATUS_OPTIONS = ['open', 'in_progress', 'completed', 'cancelled']

export default function WorkOrderDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const workOrderId = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [status, setStatus] = useState('')
  const [completedNotes, setCompletedNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load()
  }, [workOrderId])

  async function load() {
    const { data } = await supabase
      .from('fmiq_work_orders')
      .select(
        'id, asset_id, title, description, status, priority, due_date, is_recurring, recurrence_interval, completed_notes, assigned_to, fmiq_assets(name)'
      )
      .eq('id', workOrderId)
      .single()

    if (data) {
      setWorkOrder(data as unknown as WorkOrder)
      setStatus(data.status)
      setCompletedNotes(data.completed_notes || '')
    }
    setLoading(false)
  }

  function getAssetName(w: WorkOrder) {
    if (!w.fmiq_assets) return ''
    return Array.isArray(w.fmiq_assets) ? w.fmiq_assets[0]?.name : w.fmiq_assets.name
  }

  async function handleSave() {
    if (!workOrder) return
    setSaving(true)

    const { error } = await supabase
      .from('fmiq_work_orders')
      .update({
        status,
        completed_notes: completedNotes || null,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', workOrder.id)

    if (!error) setSaved(true)
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
        <p className="text-sm text-deck-dim">Task not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={workOrder.title} />
        <p className="mt-1 text-sm text-deck-dim">{getAssetName(workOrder)}</p>

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          {workOrder.description && (
            <p className="text-sm text-deck-body">{workOrder.description}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-deck-dim">
            <span>Priority: <span className="font-medium text-deck-body">{workOrder.priority}</span></span>
            {workOrder.due_date && <span>· Due {workOrder.due_date}</span>}
            {workOrder.is_recurring && (
              <span>· Recurring ({workOrder.recurrence_interval})</span>
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

          <label className="mt-4 block text-sm font-medium text-deck-body">
            Completion notes
          </label>
          <textarea
            value={completedNotes}
            onChange={(e) => setCompletedNotes(e.target.value)}
            rows={3}
            placeholder="What was done"
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
