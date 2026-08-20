'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { logWorkOrderEvent, syncTicketStatus, generateQuoteReference } from '@/lib/copsefieldWorkOrders'

type WorkOrder = {
  id: string
  ticket_id: string | null
  title: string
  description: string | null
  status: string
  quote_reference: string | null
  quote_amount: number | null
  quote_subtotal: number | null
  quote_tax: number | null
  quote_notes: string | null
  quote_sent_at: string | null
  copsefield_buildings:
    | { name: string; address: string | null; city: string | null; region: string | null; property_manager_name: string | null }
    | { name: string; address: string | null; city: string | null; region: string | null; property_manager_name: string | null }[]
    | null
}

type LineItem = {
  key: string
  id?: string
  description: string
  quantity: number
  unit_cost: number
}

function newRow(): LineItem {
  return { key: crypto.randomUUID(), description: '', quantity: 1, unit_cost: 0 }
}

export default function WorkOrderQuotePage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const workOrderId = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [rows, setRows] = useState<LineItem[]>([newRow()])
  const [includeGst, setIncludeGst] = useState(true)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [workOrderId])

  async function load() {
    const { data } = await supabase
      .from('copsefield_work_orders')
      .select(
        'id, ticket_id, title, description, status, quote_reference, quote_amount, quote_subtotal, quote_tax, quote_notes, quote_sent_at, copsefield_buildings(name, address, city, region, property_manager_name)'
      )
      .eq('id', workOrderId)
      .single()

    if (data) {
      const w = data as unknown as WorkOrder
      setWorkOrder(w)
      setNotes(w.quote_notes || '')
      setIncludeGst((w.quote_tax || 0) > 0)
    }

    const { data: lineData } = await supabase
      .from('copsefield_quote_line_items')
      .select('id, description, quantity, unit_cost')
      .eq('work_order_id', workOrderId)
      .order('sort_order', { ascending: true })

    if (lineData && lineData.length > 0) {
      setRows(lineData.map((l) => ({ key: l.id, id: l.id, description: l.description, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })))
    }

    setLoading(false)
  }

  function building(w: WorkOrder) {
    if (!w.copsefield_buildings) return null
    return Array.isArray(w.copsefield_buildings) ? w.copsefield_buildings[0] : w.copsefield_buildings
  }

  function updateRow(key: string, patch: Partial<LineItem>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
  }

  const subtotal = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0), [rows])
  const tax = includeGst ? Math.round(subtotal * 0.05 * 100) / 100 : 0
  const total = Math.round((subtotal + tax) * 100) / 100

  async function handleSend() {
    if (!workOrder) return
    const validRows = rows.filter((r) => r.description.trim())
    if (validRows.length === 0) return

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase.from('copsefield_quote_line_items').delete().eq('work_order_id', workOrder.id)
    const { error: insertError } = await supabase.from('copsefield_quote_line_items').insert(
      validRows.map((r, i) => ({
        work_order_id: workOrder.id,
        description: r.description.trim(),
        quantity: Number(r.quantity) || 1,
        unit_cost: Number(r.unit_cost) || 0,
        sort_order: i,
      }))
    )
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const reference = workOrder.quote_reference || generateQuoteReference()
    await supabase
      .from('copsefield_work_orders')
      .update({
        quote_reference: reference,
        quote_subtotal: subtotal,
        quote_tax: tax,
        quote_amount: total,
        quote_notes: notes.trim() || null,
        quote_sent_at: new Date().toISOString(),
      })
      .eq('id', workOrder.id)

    await logWorkOrderEvent(supabase, workOrder.id, 'quote_sent', `Quote ${reference} sent for ${total.toLocaleString()}`, user?.id || null)
    router.push(`/copsefield/work-orders/${workOrder.id}/quote`)
    load()
    setSaving(false)
  }

  async function handleMarkAccepted() {
    if (!workOrder) return
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('copsefield_work_orders').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', workOrder.id)
    await syncTicketStatus(supabase, workOrder.ticket_id, 'accepted')
    await logWorkOrderEvent(supabase, workOrder.id, 'status_change', `Quote ${workOrder.quote_reference || ''} accepted`, user?.id || null)
    router.push(`/copsefield/work-orders/${workOrder.id}`)
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

  const b = building(workOrder)
  const sent = !!workOrder.quote_sent_at

  // ---- Sent: read-only quote document ----
  if (sent) {
    const lineItems = rows
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="print:hidden">
            <PageHeader title="Quote" />
            <Link href={`/copsefield/work-orders/${workOrder.id}`} className="text-xs text-copsefield-accent underline">
              Back to work order
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-deck-border bg-white shadow-sm">
            <div className="flex items-center justify-between bg-copsefield-dark px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 p-1.5">
                  <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-full w-full object-contain" />
                </span>
                <span className="text-sm font-bold text-white">Copsefield Group</span>
              </div>
              <div className="text-right text-white">
                <p className="text-lg font-semibold tracking-wide">QUOTATION</p>
                <p className="font-mono text-xs text-white/80">{workOrder.quote_reference}</p>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-wrap justify-between gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">For</p>
                  <p className="mt-1 font-medium text-deck-text">{b?.name}</p>
                  {b?.address && <p className="text-xs text-deck-dim">{b.address}</p>}
                  {(b?.city || b?.region) && <p className="text-xs text-deck-dim">{[b?.city, b?.region].filter(Boolean).join(', ')}</p>}
                  {b?.property_manager_name && <p className="mt-1 text-xs text-deck-dim">Attn: {b.property_manager_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Date</p>
                  <p className="mt-1 text-deck-text">{new Date(workOrder.quote_sent_at!).toLocaleDateString()}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-deck-mute">Work order</p>
                  <p className="text-deck-text">{workOrder.title}</p>
                </div>
              </div>

              <table className="mt-6 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-deck-border text-xs uppercase tracking-wide text-deck-mute">
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Unit cost</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((r) => (
                    <tr key={r.key} className="border-b border-deck-border">
                      <td className="py-2 text-deck-text">{r.description}</td>
                      <td className="py-2 text-right text-deck-dim">{r.quantity}</td>
                      <td className="py-2 text-right text-deck-dim">{r.unit_cost.toFixed(2)}</td>
                      <td className="py-2 text-right font-medium text-deck-text">{(r.quantity * r.unit_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end">
                <div className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between text-deck-dim">
                    <span>Subtotal</span>
                    <span>{(workOrder.quote_subtotal ?? subtotal).toFixed(2)}</span>
                  </div>
                  {(workOrder.quote_tax ?? tax) > 0 && (
                    <div className="flex justify-between text-deck-dim">
                      <span>GST (5%)</span>
                      <span>{(workOrder.quote_tax ?? tax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-deck-border pt-1 text-base font-semibold text-deck-text">
                    <span>Total</span>
                    <span>{(workOrder.quote_amount ?? total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {workOrder.quote_notes && (
                <div className="mt-6 border-t border-deck-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Notes / terms</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-deck-body">{workOrder.quote_notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
            >
              Print / save as PDF
            </button>
            {workOrder.status === 'quote' && (
              <button
                onClick={handleMarkAccepted}
                disabled={saving}
                className="flex-1 rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                Mark quote accepted
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---- Draft: itemised quote builder ----
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Create quote" />
        <p className="mt-1 text-sm text-deck-dim">
          {workOrder.title} · {b?.name}
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-deck-border bg-deck-surface last:border-b-0">
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={r.description}
                      onChange={(e) => updateRow(r.key, { description: e.target.value })}
                      placeholder="e.g. Replace roof membrane - section A"
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, { quantity: Number(e.target.value) })}
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-right text-sm text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={r.unit_cost}
                      onChange={(e) => updateRow(r.key, { unit_cost: Number(e.target.value) })}
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-right text-sm text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right text-sm text-deck-dim">{((r.quantity || 0) * (r.unit_cost || 0)).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => removeRow(r.key)} className="text-deck-mute hover:text-red-600" aria-label="Remove row">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addRow} className="mt-2 text-xs font-medium text-copsefield-accent underline">
          + Add line item
        </button>

        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-deck-body">
          <input type="checkbox" checked={includeGst} onChange={(e) => setIncludeGst(e.target.checked)} />
          Add GST (5%)
        </label>

        <div className="mt-2 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-deck-dim">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {includeGst && (
              <div className="flex justify-between text-deck-dim">
                <span>GST (5%)</span>
                <span>{tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-deck-border pt-1 text-base font-semibold text-deck-text">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-deck-body">Notes / terms (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Payment terms, validity period, exclusions, etc."
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Link
            href={`/copsefield/work-orders/${workOrder.id}`}
            className="flex-1 rounded-md border border-deck-border px-3 py-2 text-center text-sm font-medium text-deck-text"
          >
            Cancel
          </Link>
          <button
            onClick={handleSend}
            disabled={saving || rows.every((r) => !r.description.trim())}
            className="flex-1 rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Sending...' : 'Send quote'}
          </button>
        </div>
      </div>
    </div>
  )
}
