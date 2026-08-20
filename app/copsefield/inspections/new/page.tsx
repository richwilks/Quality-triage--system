'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture from '@/components/CameraCapture'
import { ASSET_TAXONOMY, ASSET_CATEGORIES, ISSUE_TYPES, PRIORITY_SCALE, TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'

type Building = { id: string; name: string; building_code: string }

type OpenTicket = { id: string; unique_ref: string; asset_category: string; status: string; priority: number | null }

type DraftRow = {
  key: number
  asset_category: string
  component: string
  location: string
  issue_type: string
  observation: string
  recommendation: string
  priority: number | ''
  photoFile: File | null
  photoPreview: string | null
  saved: boolean
  saving: boolean
  uniqueRef: string | null
}

let rowKeyCounter = 0

function NewInspectionInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [buildings, setBuildings] = useState<Building[]>([])
  const [buildingId, setBuildingId] = useState('')
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([])
  const [rows, setRows] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraForRow, setCameraForRow] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('copsefield_buildings').select('id, name, building_code').order('name')
    setBuildings(data || [])
    const preset = searchParams.get('buildingId')
    if (preset) setBuildingId(preset)
    setLoading(false)
  }

  async function handleStart() {
    if (!buildingId) return
    setStarting(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: inspection, error: insertError } = await supabase
      .from('copsefield_inspections')
      .insert({ building_id: buildingId, inspector_id: user?.id })
      .select()
      .single()

    if (insertError || !inspection) {
      setError(insertError?.message || 'Could not start inspection')
      setStarting(false)
      return
    }

    const { data: existing } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, status, priority')
      .eq('building_id', buildingId)
      .in('status', ['open', 'under_review'])
      .order('created_at', { ascending: false })
    setOpenTickets(existing || [])

    setInspectionId(inspection.id)
    setStarting(false)
  }

  function addRow() {
    rowKeyCounter += 1
    setRows((prev) => [
      ...prev,
      {
        key: rowKeyCounter,
        asset_category: '',
        component: '',
        location: '',
        issue_type: 'condition',
        observation: '',
        recommendation: '',
        priority: '',
        photoFile: null,
        photoPreview: null,
        saved: false,
        saving: false,
        uniqueRef: null,
      },
    ])
  }

  function updateRow(key: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function applyPhotoToRow(key: number, file: File) {
    updateRow(key, { photoFile: file, photoPreview: URL.createObjectURL(file) })
  }

  async function saveRow(key: number) {
    const row = rows.find((r) => r.key === key)
    if (!row || !row.asset_category || !row.observation.trim()) return
    updateRow(key, { saving: true })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const building = buildings.find((b) => b.id === buildingId)

    let photoUrl: string | null = null
    if (row.photoFile) {
      const path = `${Date.now()}-${row.photoFile.name}`
      const { error: uploadError } = await supabase.storage.from('copsefield-ticket-photos').upload(path, row.photoFile)
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`)
        updateRow(key, { saving: false })
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('copsefield-ticket-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }

    const { data: maxRow } = await supabase
      .from('copsefield_tickets')
      .select('recommendation_number')
      .eq('building_id', buildingId)
      .order('recommendation_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = (maxRow?.recommendation_number || 0) + 1
    const uniqueRef = `${building?.building_code}-${String(nextNumber).padStart(3, '0')}`

    const { error: insertError } = await supabase.from('copsefield_tickets').insert({
      building_id: buildingId,
      inspection_id: inspectionId,
      recommendation_number: nextNumber,
      unique_ref: uniqueRef,
      asset_category: row.asset_category,
      component: row.component || null,
      location: row.location.trim() || null,
      issue_type: row.issue_type,
      observation: row.observation.trim(),
      recommendation: row.recommendation.trim() || null,
      priority: row.priority !== '' ? row.priority : null,
      status: 'recommended',
      photo_url: photoUrl,
      raised_by: user?.id,
      raised_by_type: 'staff',
    })

    if (insertError) {
      setError(insertError.message)
      updateRow(key, { saving: false })
      return
    }

    updateRow(key, { saving: false, saved: true, uniqueRef })
  }

  async function handleComplete() {
    if (!inspectionId) return
    setCompleting(true)
    await supabase.from('copsefield_inspections').update({ status: 'completed' }).eq('id', inspectionId)
    router.push(`/copsefield/inspections/${inspectionId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!inspectionId) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <PageHeader title="New inspection" />
          <label className="mt-4 block text-sm font-medium text-deck-body">Building</label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          >
            <option value="">Select a building...</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.building_code})
              </option>
            ))}
          </select>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleStart}
            disabled={starting || !buildingId}
            className="mt-4 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {starting ? 'Starting...' : 'Start inspection'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      {cameraForRow !== null && (
        <CameraCapture
          onCapture={(captured: File) => {
            applyPhotoToRow(cameraForRow, captured)
            setCameraForRow(null)
          }}
          onClose={() => setCameraForRow(null)}
        />
      )}
      <div className="mx-auto max-w-2xl">
        <PageHeader title={buildings.find((b) => b.id === buildingId)?.name || 'Inspection'} />
        <p className="mt-1 text-sm text-deck-dim">Add a row for each item you find. Save each as you go.</p>

        {openTickets.length > 0 && (
          <>
            <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-deck-dim">
              Existing open tickets ({openTickets.length})
            </h2>
            <div className="mt-2 space-y-1.5">
              {openTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/copsefield/tickets/${t.id}`}
                  className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-mono text-deck-dim">{t.unique_ref}</p>
                    <p className="text-sm text-deck-text">{t.asset_category}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-deck-dim">New items ({rows.length})</h2>

        <div className="mt-2 space-y-3">
          {rows.map((row) => {
            const components = row.asset_category ? ASSET_TAXONOMY[row.asset_category] || [] : []
            if (row.saved) {
              return (
                <div key={row.key} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-mono text-emerald-700">{row.uniqueRef}</p>
                  <p className="text-sm text-deck-text">
                    {row.asset_category}
                    {row.component ? ` · ${row.component}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-deck-dim">{row.observation}</p>
                </div>
              )
            }
            return (
              <div key={row.key} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                <select
                  value={row.asset_category}
                  onChange={(e) => updateRow(row.key, { asset_category: e.target.value, component: '' })}
                  className="w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                >
                  <option value="">Category...</option>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {components.length > 0 && (
                  <select
                    value={row.component}
                    onChange={(e) => updateRow(row.key, { component: e.target.value })}
                    className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                  >
                    <option value="">Component (optional)...</option>
                    {components.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  value={row.location}
                  onChange={(e) => updateRow(row.key, { location: e.target.value })}
                  placeholder="Location (optional)"
                  className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
                />

                <select
                  value={row.issue_type}
                  onChange={(e) => updateRow(row.key, { issue_type: e.target.value })}
                  className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={row.observation}
                  onChange={(e) => updateRow(row.key, { observation: e.target.value })}
                  placeholder="Observation"
                  rows={2}
                  className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
                />

                <textarea
                  value={row.recommendation}
                  onChange={(e) => updateRow(row.key, { recommendation: e.target.value })}
                  placeholder="Recommendation (optional)"
                  rows={2}
                  className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
                />

                <select
                  value={row.priority}
                  onChange={(e) => updateRow(row.key, { priority: e.target.value ? Number(e.target.value) : '' })}
                  className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-sm text-deck-text"
                >
                  <option value="">Priority (optional)</option>
                  {PRIORITY_SCALE.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.value} - {p.label}
                    </option>
                  ))}
                </select>
                {row.priority !== '' && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(row.priority as number)}`}>
                    P{row.priority}
                  </span>
                )}

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraForRow(row.key)}
                    className="flex-1 rounded-md border border-deck-border px-2.5 py-1.5 text-xs font-medium text-deck-text"
                  >
                    Take photo
                  </button>
                  <label className="flex-1 cursor-pointer rounded-md border border-deck-border px-2.5 py-1.5 text-center text-xs font-medium text-deck-text">
                    Choose photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) applyPhotoToRow(row.key, f)
                      }}
                    />
                  </label>
                </div>
                {row.photoPreview && <img src={row.photoPreview} alt="Item" className="mt-2 w-full rounded-md" />}

                <button
                  onClick={() => saveRow(row.key)}
                  disabled={row.saving || !row.asset_category || !row.observation.trim()}
                  className="mt-3 w-full rounded-md bg-copsefield-accent px-3 py-1.5 text-sm font-medium text-deck-bg disabled:opacity-50"
                >
                  {row.saving ? 'Saving...' : 'Save item'}
                </button>
              </div>
            )
          })}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={addRow}
          className="mt-3 w-full rounded-md border border-copsefield-accent px-3 py-2 text-sm font-medium text-copsefield-accent"
        >
          + Add item
        </button>

        <button
          onClick={handleComplete}
          disabled={completing}
          className="mt-5 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
        >
          {completing ? 'Completing...' : 'Complete inspection'}
        </button>
      </div>
    </div>
  )
}

export default function NewInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewInspectionInner />
    </Suspense>
  )
}
