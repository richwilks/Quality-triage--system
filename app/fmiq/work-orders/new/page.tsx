'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Asset = { id: string; name: string }
type Colleague = { id: string; full_name: string | null; email: string | null }

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

function NewWorkOrderInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialAssetId = searchParams.get('assetId') || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [assetId, setAssetId] = useState(initialAssetId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState('monthly')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_name) return

    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name')
      .eq('company_name', profile.company_name)
      .order('name', { ascending: true })
    setAssets(assetData || [])
    if (!initialAssetId && assetData && assetData.length > 0) {
      setAssetId(assetData[0].id)
    }

    const { data: colleagueData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_name', profile.company_name)
      .eq('has_fmiq_access', true)
    setColleagues(colleagueData || [])
  }

  async function handleCreate() {
    if (!assetId) {
      setError('Choose an asset.')
      return
    }
    if (!title.trim()) {
      setError('Give the task a title.')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_name) {
      setError('Your account has no company set - contact an admin.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('fmiq_work_orders').insert({
      asset_id: assetId,
      company_name: profile.company_name,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? recurrenceInterval : null,
      created_by: user.id,
    })

    if (insertError) {
      setError(`Could not create the task: ${insertError.message}`)
      setSaving(false)
      return
    }

    router.push(`/fmiq/assets/${assetId}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="New Task" />

        <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          {assets.length === 0 ? (
            <p className="text-sm text-deck-dim">
              No assets yet - add one first before creating a task.
            </p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-deck-body">Asset</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-deck-body">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Replace air filter"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Assign to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              <option value="">Unassigned</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email || 'Unnamed'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-deck-body">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring (PPM)
            </label>
            {isRecurring && (
              <select
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value)}
                className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving || assets.length === 0}
            className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewWorkOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewWorkOrderInner />
    </Suspense>
  )
}
