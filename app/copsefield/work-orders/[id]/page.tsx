'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { WORK_ORDER_STATUSES, WORK_ORDER_STATUS_COLOR, WORK_ORDER_PRIORITY_COLOR } from '@/lib/copsefieldTaxonomy'
import { logWorkOrderEvent, syncTicketStatus } from '@/lib/copsefieldWorkOrders'

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
  quote_reference: string | null
  quote_amount: number | null
  quote_notes: string | null
  quote_sent_at: string | null
  accepted_at: string | null
  contractor_id: string | null
  contractor_name: string | null
  scheduled_start_date: string | null
  issued_at: string | null
  completed_at: string | null
  copsefield_buildings: { name: string } | { name: string }[] | null
}

type WorkOrderEvent = {
  id: string
  event_type: string
  description: string
  created_at: string
}

type MaterialOrder = {
  id: string
  description: string
  cost_estimate: number | null
  created_at: string
}

type Contractor = {
  id: string
  name: string
  trade: string | null
}

const STAGE_ORDER = ['quote', 'accepted', 'issued', 'in_progress', 'completed']

export default function WorkOrderDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const workOrderId = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [events, setEvents] = useState<WorkOrderEvent[]>([])
  const [materialOrders, setMaterialOrders] = useState<MaterialOrder[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [materialDesc, setMaterialDesc] = useState('')
  const [materialCost, setMaterialCost] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [scheduledStartDate, setScheduledStartDate] = useState('')

  useEffect(() => {
    load()
  }, [workOrderId])

  async function load() {
    const { data } = await supabase
      .from('copsefield_work_orders')
      .select(
        'id, ticket_id, building_id, title, description, status, priority, cost_estimate_low, cost_estimate_high, quote_reference, quote_amount, quote_notes, quote_sent_at, accepted_at, contractor_id, contractor_name, scheduled_start_date, issued_at, completed_at, copsefield_buildings(name)'
      )
      .eq('id', workOrderId)
      .single()

    if (data) {
      const w = data as unknown as WorkOrder
      setWorkOrder(w)
      setContractorId(w.contractor_id || '')
      setContractorName(w.contractor_name || '')
      setScheduledStartDate(w.scheduled_start_date || '')
    }

    const { data: contractorData } = await supabase
      .from('copsefield_contractors')
      .select('id, name, trade')
      .eq('active', true)
      .order('name', { ascending: true })
    setContractors(contractorData || [])

    const { data: eventData } = await supabase
      .from('copsefield_work_order_events')
      .select('id, event_type, description, created_at')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
    setEvents(eventData || [])

    const { data: materialData } = await supabase
      .from('copsefield_material_orders')
      .select('id, description, cost_estimate, created_at')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
    setMaterialOrders(materialData || [])

    setLoading(false)
  }

  function getBuildingName(w: WorkOrder) {
    if (!w.copsefield_buildings) return ''
    return Array.isArray(w.copsefield_buildings) ? w.copsefield_buildings[0]?.name : w.copsefield_buildings.name
  }

  async function currentUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id || null
  }

  async function handleMarkAccepted() {
    if (!workOrder) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase.from('copsefield_work_orders').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'accepted')
    await logWorkOrderEvent(supabase, workOrder.id, 'status_change', `Quote ${workOrder.quote_reference || ''} accepted`, userId)
    load()
    setBusy(false)
  }

  async function handleAddMaterialOrder() {
    if (!workOrder || !materialDesc.trim()) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase.from('copsefield_material_orders').insert({
      work_order_id: workOrder.id,
      description: materialDesc.trim(),
      cost_estimate: materialCost ? Number(materialCost) : null,
      created_by: userId,
    })
    await logWorkOrderEvent(supabase, workOrder.id, 'material_order', `Material order raised: ${materialDesc.trim()}`, userId)
    setMaterialDesc('')
    setMaterialCost('')
    load()
    setBusy(false)
  }

  async function handleMarkIssued() {
    if (!workOrder || !contractorName.trim()) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase
      .from('copsefield_work_orders')
      .update({
        status: 'issued',
        contractor_id: contractorId || null,
        contractor_name: contractorName.trim(),
        scheduled_start_date: scheduledStartDate || null,
        issued_at: new Date().toISOString(),
      })
      .eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'issued')
    await logWorkOrderEvent(
      supabase,
      workOrder.id,
      'status_change',
      `Issued to ${contractorName.trim()}${scheduledStartDate ? ` - start date ${scheduledStartDate}` : ''}`,
      userId
    )
    load()
    setBusy(false)
  }

  async function handleSaveSchedule() {
    if (!workOrder) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase
      .from('copsefield_work_orders')
      .update({
        contractor_id: contractorId || null,
        contractor_name: contractorName.trim() || null,
        scheduled_start_date: scheduledStartDate || null,
      })
      .eq('id', workOrder.id)
    await logWorkOrderEvent(
      supabase,
      workOrder.id,
      'note',
      `Schedule updated: ${contractorName.trim() || 'no contractor set'}${scheduledStartDate ? `, start date ${scheduledStartDate}` : ''}`,
      userId
    )
    load()
    setBusy(false)
  }

  async function handleMarkInProgress() {
    if (!workOrder) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase.from('copsefield_work_orders').update({ status: 'in_progress' }).eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'in_progress')
    await logWorkOrderEvent(supabase, workOrder.id, 'status_change', 'Work started', userId)
    load()
    setBusy(false)
  }

  async function handleMarkCompleted() {
    if (!workOrder) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase.from('copsefield_work_orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'completed')
    await logWorkOrderEvent(supabase, workOrder.id, 'status_change', 'Work order completed', userId)
    load()
    setBusy(false)
  }

  async function handleCancel() {
    if (!workOrder) return
    setBusy(true)
    const userId = await currentUserId()
    await supabase.from('copsefield_work_orders').update({ status: 'cancelled' }).eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'cancelled')
    await logWorkOrderEvent(supabase, workOrder.id, 'status_change', 'Work order cancelled', userId)
    load()
    setBusy(false)
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

  const stageIndex = STAGE_ORDER.indexOf(workOrder.status)
  const cancelled = workOrder.status === 'cancelled'

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title={workOrder.title} />
        <p className="mt-1 text-sm text-deck-dim">{getBuildingName(workOrder)}</p>
        {workOrder.ticket_id && (
          <Link href={`/copsefield/tickets/${workOrder.ticket_id}`} className="mt-1 inline-block text-xs text-copsefield-accent underline">
            View source ticket
          </Link>
        )}

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">

        {/* Stage indicator */}
        {!cancelled ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {STAGE_ORDER.map((stage, i) => (
              <span
                key={stage}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  i < stageIndex
                    ? 'bg-emerald-100 text-emerald-700'
                    : i === stageIndex
                      ? WORK_ORDER_STATUS_COLOR[stage]
                      : 'bg-deck-raised text-deck-mute'
                }`}
              >
                {WORK_ORDER_STATUSES.find((s) => s.value === stage)?.label || stage}
              </span>
            ))}
          </div>
        ) : (
          <span className="mt-4 inline-block rounded-full bg-deck-raised px-2.5 py-1 text-xs font-medium text-deck-mute">Cancelled</span>
        )}

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          {workOrder.description && <p className="text-sm text-deck-body">{workOrder.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-deck-dim">
            <span className="flex items-center gap-1.5">
              Priority:
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${WORK_ORDER_PRIORITY_COLOR[workOrder.priority] || 'bg-deck-raised text-deck-mute'}`}>
                {workOrder.priority}
              </span>
            </span>
            {workOrder.cost_estimate_low !== null && (
              <span>
                · Est. {workOrder.cost_estimate_low}-{workOrder.cost_estimate_high}
              </span>
            )}
          </div>
        </div>

        {/* Quote stage */}
        {!cancelled && workOrder.status === 'quote' && (
          <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Quote</h2>
            {workOrder.quote_sent_at ? (
              <>
                <p className="mt-2 text-sm text-deck-text">
                  <span className="font-mono text-xs text-deck-dim">{workOrder.quote_reference}</span> · {workOrder.quote_amount}
                </p>
                <p className="mt-1 text-xs text-deck-mute">Sent {new Date(workOrder.quote_sent_at).toLocaleDateString()}</p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/copsefield/work-orders/${workOrder.id}/quote`}
                    className="flex-1 rounded-md border border-copsefield-accent px-3 py-2 text-center text-sm font-medium text-copsefield-accent"
                  >
                    View quote
                  </Link>
                  <button
                    onClick={handleMarkAccepted}
                    disabled={busy}
                    className="flex-1 rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                  >
                    Mark accepted
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-deck-dim">No quote raised yet.</p>
                <Link
                  href={`/copsefield/work-orders/${workOrder.id}/quote`}
                  className="mt-3 block w-full rounded-md bg-copsefield-accent px-3 py-2 text-center text-sm font-medium text-deck-bg"
                >
                  Create quote
                </Link>
              </>
            )}
          </div>
        )}

        {/* Accepted stage - material orders + prep for issuing */}
        {!cancelled && stageIndex >= STAGE_ORDER.indexOf('accepted') && (
          <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Material orders</h2>
            <div className="mt-2 space-y-1.5">
              {materialOrders.map((m) => (
                <div key={m.id} className="rounded-md border border-deck-border px-3 py-2 text-sm">
                  <p className="text-deck-text">{m.description}</p>
                  {m.cost_estimate !== null && <p className="text-xs text-deck-dim">Est. {m.cost_estimate}</p>}
                </div>
              ))}
              {materialOrders.length === 0 && <p className="text-xs text-deck-dim">No material orders raised yet.</p>}
            </div>
            {workOrder.status === 'accepted' && (
              <div className="mt-3 flex gap-2">
                <input spellCheck="true"
                  type="text"
                  value={materialDesc}
                  onChange={(e) => setMaterialDesc(e.target.value)}
                  placeholder="Material/description"
                  className="flex-1 rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-xs text-deck-text placeholder:text-deck-mute"
                />
                <input
                  type="number"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(e.target.value)}
                  placeholder="Est. cost"
                  className="w-24 rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-xs text-deck-text placeholder:text-deck-mute"
                />
                <button
                  onClick={handleAddMaterialOrder}
                  disabled={busy || !materialDesc.trim()}
                  className="rounded-md bg-copsefield-accent px-3 py-1.5 text-xs font-medium text-deck-bg disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}

        {/* Issue stage - assign worker/contractor + schedule */}
        {!cancelled && stageIndex >= STAGE_ORDER.indexOf('accepted') && (
          <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Worker / contractor &amp; schedule</h2>
            <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-deck-body">From supply chain</label>
                <select
                  value={contractorId}
                  onChange={(e) => {
                    const id = e.target.value
                    setContractorId(id)
                    const c = contractors.find((x) => x.id === id)
                    if (c) setContractorName(c.name)
                  }}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
                >
                  <option value="">Not in directory / other</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.trade ? ` (${c.trade})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-deck-body">Assigned to (worker or subcontractor)</label>
                <input spellCheck="true"
                  type="text"
                  value={contractorName}
                  onChange={(e) => {
                    setContractorName(e.target.value)
                    setContractorId('')
                  }}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-deck-body">Agreed start date</label>
                <input
                  type="date"
                  value={scheduledStartDate}
                  onChange={(e) => setScheduledStartDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
                />
              </div>
            </div>

            {workOrder.status === 'accepted' && (
              <button
                onClick={handleMarkIssued}
                disabled={busy || !contractorName.trim()}
                className="mt-3 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                Mark issued
              </button>
            )}
            {workOrder.status !== 'accepted' && (
              <button
                onClick={handleSaveSchedule}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-copsefield-accent px-3 py-2 text-sm font-medium text-copsefield-accent disabled:opacity-50"
              >
                Save changes
              </button>
            )}
          </div>
        )}

        {/* Progress / completion */}
        {!cancelled && workOrder.status === 'issued' && (
          <button
            onClick={handleMarkInProgress}
            disabled={busy}
            className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            Mark work in progress
          </button>
        )}
        {!cancelled && workOrder.status === 'in_progress' && (
          <button
            onClick={handleMarkCompleted}
            disabled={busy}
            className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            Mark completed
          </button>
        )}
        {workOrder.status === 'completed' && workOrder.completed_at && (
          <p className="mt-4 text-sm text-emerald-700">Completed {new Date(workOrder.completed_at).toLocaleDateString()}</p>
        )}

        {!cancelled && workOrder.status !== 'completed' && (
          <button
            onClick={handleCancel}
            disabled={busy}
            className="mt-3 w-full rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
          >
            Cancel work order
          </button>
        )}

        </div>

        {/* Audit trail */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Activity</h2>
          <div className="mt-2 space-y-1.5">
            {events.map((e) => (
              <div key={e.id} className="rounded-md border border-deck-border bg-deck-surface px-3 py-2">
                <p className="text-sm text-deck-text">{e.description}</p>
                <p className="mt-0.5 text-xs text-deck-mute">{new Date(e.created_at).toLocaleString()}</p>
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-deck-dim">No activity recorded yet.</p>}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
