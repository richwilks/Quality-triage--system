'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { TICKET_STATUS_COLOR, priorityColor, DIARY_ENTRY_TYPES, DIARY_ENTRY_TYPE_COLOR, WORK_ORDER_PRIORITY_COLOR } from '@/lib/copsefieldTaxonomy'

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

type DiaryEntry = {
  id: string
  title: string
  notes: string | null
  entry_date: string
  start_time: string | null
  end_time: string | null
  entry_type: string
  created_by: string | null
  copsefield_buildings: { name: string } | { name: string }[] | null
}

type Colleague = { id: string; full_name: string | null; email: string | null }

export default function MyTasksPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([])
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [forUserId, setForUserId] = useState('')
  const [title, setTitle] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [entryType, setEntryType] = useState('appointment')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    setUserId(user.id)
    setForUserId(user.id)

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

    const today = new Date().toISOString().slice(0, 10)
    const { data: diaryData } = await supabase
      .from('copsefield_diary_entries')
      .select('id, title, notes, entry_date, start_time, end_time, entry_type, created_by, copsefield_buildings(name)')
      .eq('user_id', user.id)
      .gte('entry_date', today)
      .order('entry_date', { ascending: true })
      .order('start_time', { ascending: true })
    setDiaryEntries((diaryData || []) as unknown as DiaryEntry[])

    const { data: colleagueData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('has_copsefield_access', true)
      .eq('copsefield_role', 'staff')
    setColleagues(colleagueData || [])

    setLoading(false)
  }

  function name(rel: { name: string } | { name: string }[] | null) {
    if (!rel) return ''
    return Array.isArray(rel) ? rel[0]?.name : rel.name
  }

  async function handleAddEntry() {
    if (!title.trim() || !entryDate || !forUserId) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('copsefield_diary_entries').insert({
      user_id: forUserId,
      title: title.trim(),
      notes: notes.trim() || null,
      entry_date: entryDate,
      start_time: startTime || null,
      end_time: endTime || null,
      entry_type: entryType,
      created_by: userId,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setTitle('')
      setEntryDate('')
      setStartTime('')
      setEndTime('')
      setNotes('')
      setEntryType('appointment')
      setMessage(forUserId === userId ? 'Added to your diary.' : "Added to their diary.")
      setShowForm(false)
      load()
    }
    setSaving(false)
  }

  async function handleDeleteEntry(id: string) {
    await supabase.from('copsefield_diary_entries').delete().eq('id', id)
    setDiaryEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function formatTime(t: string | null) {
    if (!t) return null
    return t.slice(0, 5)
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

        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Diary ({diaryEntries.length})</h2>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="text-xs font-medium text-copsefield-accent underline"
          >
            {showForm ? 'Cancel' : '+ Add appointment'}
          </button>
        </div>

        {showForm && (
          <div className="mt-2 rounded-lg border border-deck-border bg-deck-surface p-3">
            <label className="block text-xs font-medium text-deck-body">For</label>
            <select
              value={forUserId}
              onChange={(e) => setForUserId(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
            >
              {userId && <option value={userId}>Me</option>}
              {colleagues
                .filter((c) => c.id !== userId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email || 'Unnamed'}
                  </option>
                ))}
            </select>

            <label className="mt-2 block text-xs font-medium text-deck-body">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site inspection - Kelowna Towers"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
            />

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-deck-body">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-deck-body">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-deck-body">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                />
              </div>
            </div>

            <label className="mt-2 block text-xs font-medium text-deck-body">Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
            >
              {DIARY_ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="mt-2 block text-xs font-medium text-deck-body">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
            />

            <button
              onClick={handleAddEntry}
              disabled={saving || !title.trim() || !entryDate}
              className="mt-3 w-full rounded-md bg-copsefield-accent px-3 py-1.5 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add to diary'}
            </button>
          </div>
        )}

        {message && <p className="mt-2 text-xs text-deck-dim">{message}</p>}

        {diaryEntries.length === 0 && !showForm && <p className="mt-2 text-sm text-deck-dim">Nothing booked in your diary.</p>}
        {diaryEntries.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {diaryEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-deck-text">{e.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DIARY_ENTRY_TYPE_COLOR[e.entry_type]}`}>
                      {DIARY_ENTRY_TYPES.find((t) => t.value === e.entry_type)?.label || e.entry_type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-deck-dim">
                    {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {formatTime(e.start_time) ? ` · ${formatTime(e.start_time)}${formatTime(e.end_time) ? `-${formatTime(e.end_time)}` : ''}` : ''}
                    {name(e.copsefield_buildings) ? ` · ${name(e.copsefield_buildings)}` : ''}
                    {e.created_by && e.created_by !== userId ? ' · booked by a colleague' : ''}
                  </p>
                  {e.notes && <p className="mt-0.5 text-xs text-deck-mute">{e.notes}</p>}
                </div>
                <button onClick={() => handleDeleteEntry(e.id)} className="text-xs font-medium text-red-600">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">
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
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${WORK_ORDER_PRIORITY_COLOR[w.priority] || 'bg-deck-raised text-deck-mute'}`}>
                        {w.priority}
                      </span>
                    </td>
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
