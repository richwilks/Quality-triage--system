'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'

type Drawing = { id: string; name: string | null; image_url: string | null }
type Defect = {
  id: string
  title: string | null
  status: string
  ncr_number: string | null
  element_type: string | null
  classification: string | null
  photo_url: string | null
  pin_x: number
  pin_y: number
}

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'pending_approval', 'closed', 'rejected']

// Matches the hex values in tailwind.config.ts colors.status.* - pins are plain
// positioned divs, not Tailwind-classed elements, so the color has to be a literal.
const STATUS_DOT_COLOR: Record<string, string> = {
  draft: '#94A3B8',
  confirmed: '#3B82F6',
  assigned: '#D97706',
  pending_approval: '#7C3AED',
  closed: '#15803D',
  rejected: '#B91C1C',
}

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  floor: 'Floor',
  wall: 'Wall',
  ceiling: 'Ceiling',
  structural_steel: 'Structural steel',
  cladding_envelope: 'Cladding / envelope',
  fire_penetration: 'Fire penetration / seal',
  movement_joint: 'Movement joint',
  mep: 'MEP',
  other: 'Other',
}

export default function PlanViewPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [drawingId, setDrawingId] = useState('')
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null)
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    loadDrawings()
  }, [projectId])

  useEffect(() => {
    if (drawingId) loadDefects()
  }, [drawingId])

  async function loadDrawings() {
    const { data } = await supabase
      .from('drawings')
      .select('id, name, image_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setDrawings(data || [])
    if (data && data.length > 0) setDrawingId(data[0].id)
    setLoading(false)
  }

  async function loadDefects() {
    const { data } = await supabase
      .from('defects')
      .select('id, title, status, ncr_number, element_type, classification, photo_url, pin_x, pin_y')
      .eq('project_id', projectId)
      .eq('drawing_id', drawingId)
      .not('pin_x', 'is', null)
      .not('pin_y', 'is', null)
    setDefects(data || [])
  }

  const drawing = drawings.find((d) => d.id === drawingId) || null

  const filteredDefects = defects.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (categoryFilter !== 'all' && d.classification !== categoryFilter) return false
    if (typeFilter !== 'all' && d.element_type !== typeFilter) return false
    return true
  })

  const usedElementTypes = Array.from(new Set(defects.map((d) => d.element_type).filter(Boolean))) as string[]
  const selectedDefect = selectedDefectId ? defects.find((d) => d.id === selectedDefectId) : null

  function handlePinClick(e: React.MouseEvent, defectId: string) {
    e.stopPropagation()
    setPendingPin(null)
    setSelectedDefectId((current) => (current === defectId ? null : defectId))
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSelectedDefectId(null)
    setPendingPin({ x, y })
  }

  function handleRaiseDefectHere() {
    if (!drawing || !pendingPin) return
    const query = new URLSearchParams({
      projectId,
      drawingId: drawing.id,
      pinX: pendingPin.x.toFixed(1),
      pinY: pendingPin.y.toFixed(1),
      location: drawing.name || 'Plan view',
    })
    router.push(`/dashboard/new-defect?${query.toString()}`)
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
        <div className="flex items-center justify-between">
          <PageHeader title="Plan view" />
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="whitespace-nowrap text-xs font-medium text-deck-text underline"
          >
            List view
          </Link>
        </div>

        {drawings.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">
            No drawings uploaded for this project yet.{' '}
            <Link href={`/dashboard/drawings?projectId=${projectId}`} className="underline">
              Upload one
            </Link>
            .
          </p>
        )}

        {drawings.length > 0 && (
          <>
            {drawings.length > 1 && (
              <select
                value={drawingId}
                onChange={(e) => {
                  setDrawingId(e.target.value)
                  setSelectedDefectId(null)
                  setPendingPin(null)
                }}
                className="mt-4 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                {drawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || 'Untitled drawing'}
                  </option>
                ))}
              </select>
            )}

            <p className="mt-2 text-sm text-deck-dim">
              Tap a pin to see that defect, or tap anywhere else on the plan to raise a new one.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
                aria-label="Filter by category"
              >
                <option value="all">Snag &amp; NCR</option>
                <option value="snag">Snag only</option>
                <option value="ncr">NCR only</option>
              </select>
              {usedElementTypes.length > 0 && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  {usedElementTypes.map((t) => (
                    <option key={t} value={t}>
                      {ELEMENT_TYPE_LABELS[t] || t}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div
              className="relative mt-3 w-full cursor-crosshair overflow-hidden rounded-lg border border-deck-border"
              onClick={handleImageClick}
            >
              {drawing?.image_url && (
                <img src={drawing.image_url} alt={drawing.name || 'Drawing'} className="w-full" />
              )}

              {filteredDefects.map((d) => (
                <div
                  key={d.id}
                  onClick={(e) => handlePinClick(e, d.id)}
                  style={{
                    position: 'absolute',
                    left: `${d.pin_x}%`,
                    top: `${d.pin_y}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                  className="cursor-pointer"
                >
                  <div
                    className="h-4 w-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: STATUS_DOT_COLOR[d.status] || STATUS_DOT_COLOR.draft }}
                  />
                </div>
              ))}

              {pendingPin && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="h-4 w-4 rounded-full border-2 border-white bg-deck-accent shadow" />
                </div>
              )}
            </div>

            {defects.length === 0 && (
              <p className="mt-3 text-sm text-deck-dim">
                No defects are pinned to this drawing yet - raise one from the drawing's pin page, or tap the plan
                above to start one here.
              </p>
            )}

            {selectedDefect && (
              <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
                <div className="flex items-start gap-3">
                  {selectedDefect.photo_url && (
                    <img
                      src={selectedDefect.photo_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-deck-text">
                        {selectedDefect.title || 'Untitled'}
                      </p>
                      <StatusBadge status={selectedDefect.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-deck-dim">
                      {selectedDefect.ncr_number ? `${selectedDefect.ncr_number} - ` : ''}
                      {selectedDefect.element_type
                        ? ELEMENT_TYPE_LABELS[selectedDefect.element_type] || selectedDefect.element_type
                        : 'Uncategorized'}
                    </p>
                    <Link
                      href={`/dashboard/defects/${selectedDefect.id}`}
                      className="mt-1 inline-block text-xs font-medium text-deck-accent underline"
                    >
                      View full defect &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {pendingPin && (
              <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
                <button
                  onClick={handleRaiseDefectHere}
                  className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg"
                >
                  Raise a defect here
                </button>
                <button
                  onClick={() => setPendingPin(null)}
                  className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
