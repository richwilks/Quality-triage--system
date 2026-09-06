'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Building = { id: string; name: string }
type Colleague = { id: string; full_name: string | null; email: string | null }

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

function NewWorkOrderInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialBuildingId = searchParams.get('buildingId') || ''

  const [buildings, setBuildings] = useState<Building[]>([])
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [buildingId, setBuildingId] = useState(initialBuildingId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
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

    const { data: buildingData } = await supabase.from('copsefield_buildings').select('id, name').order('name')
    setBuildings(buildingData || [])
    if (!initialBuildingId && buildingData && buildingData.length > 0) {
      setBuildingId(buildingData[0].id)
    }

    const { data: colleagueData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('has_copsefield_access', true)
      .eq('copsefield_role', 'staff')
    setColleagues(colleagueData || [])
  }

  async function handleCreate() {
    if (!buildingId) {
      setError('Choose a building.')
      return
    }
    if (!title.trim()) {
      setError('Give the work order a title.')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('copsefield_work_orders').insert({
      building_id: buildingId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      created_by: user?.id,
    })

    if (insertError) {
      setError(`Could not create the work order: ${insertError.message}`)
      setSaving(false)
      return
    }

    router.push(`/copsefield/buildings/${buildingId}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="New Work Order" />

        <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          {buildings.length === 0 ? (
            <p className="text-sm text-deck-dim">No buildings yet - add one first before creating a work order.</p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-deck-body">Building</label>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-deck-body">Title</label>
            <input spellCheck="true"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Replace roof membrane"
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Description</label>
            <textarea spellCheck="true"
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving || buildings.length === 0}
            className="w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create work order'}
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
