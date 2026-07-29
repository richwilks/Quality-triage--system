'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Partner = { id: string; full_name: string | null; company_name: string | null }

type BoundingBox = { x: number; y: number; width: number; height: number }

type Defect = {
  id: string
  project_id: string
  title: string | null
  photo_url: string | null
  ai_description: string | null
  ai_confidence: number | null
  standard_reference: string | null
  description: string | null
  assigned_partner_id: string | null
  target_close_date: string | null
  bounding_box: BoundingBox | null
  classification: string | null
  ncr_number: string | null
  root_cause: string | null
  corrective_action: string | null
  projects: { name: string } | { name: string }[] | null
}

const DEFAULT_BOX: BoundingBox = { x: 35, y: 35, width: 30, height: 30 }

export default function ReviewDefectsPage() {
  const supabase = createClient()

  const [defects, setDefects] = useState<Defect[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [editedText, setEditedText] = useState<Record<string, string>>({})
  const [assignedPartner, setAssignedPartner] = useState<Record<string, string>>({})
  const [targetDate, setTargetDate] = useState<Record<string, string>>({})
  const [boxes, setBoxes] = useState<Record<string, BoundingBox>>({})
  const [classification, setClassification] = useState<Record<string, string>>({})
  const [rootCause, setRootCause] = useState<Record<string, string>>({})
  const [correctiveAction, setCorrectiveAction] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dragState = useRef<{ id: string; startX: number; startY: number; boxX: number; boxY: number } | null>(null)
  const resizeState = useRef<{ id: string; startX: number; startY: number; boxW: number; boxH: number } | null>(null)

  useEffect(() => {
    loadDefects()
  }, [])

  async function loadDefects() {
    setLoading(true)
    const { data } = await supabase
      .from('defects')
      .select(
        'id, project_id, title, photo_url, ai_description, ai_confidence, standard_reference, description, assigned_partner_id, target_close_date, bounding_box, classification, ncr_number, root_cause, corrective_action, projects(name)'
      )
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    const list = (data || []) as unknown as Defect[]
    setDefects(list)

    const initialText: Record<string, string> = {}
    const initialPartner: Record<string, string> = {}
    const initialDate: Record<string, string> = {}
    const initialBoxes: Record<string, BoundingBox> = {}
    const initialClass: Record<string, string> = {}
    const initialRootCause: Record<string, string> = {}
    const initialCorrective: Record<string, string> = {}
    list.forEach((d) => {
      initialText[d.id] = d.description || d.ai_description || ''
      initialPartner[d.id] = d.assigned_partner_id || ''
      initialDate[d.id] = d.target_close_date || ''
      initialBoxes[d.id] = d.bounding_box || DEFAULT_BOX
      initialClass[d.id] = d.classification || 'snag'
      initialRootCause[d.id] = d.root_cause || ''
      initialCorrective[d.id] = d.corrective_action || ''
    })
    setEditedText(initialText)
    setAssignedPartner(initialPartner)
    setTargetDate(initialDate)
    setBoxes(initialBoxes)
    setClassification(initialClass)
    setRootCause(initialRootCause)
    setCorrectiveAction(initialCorrective)

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('role', 'partner')
    setPartners(partnerData || [])

    setLoading(false)
  }

  function getProjectName(d: Defect) {
    if (!d.projects) return ''
    return Array.isArray(d.projects) ? d.projects[0]?.name : d.projects.name
  }

  function handlePointerDown(e: React.PointerEvent, defectId: string) {
    e.preventDefault()
    const box = boxes[defectId] || DEFAULT_BOX
    dragState.current = {
      id: defectId,
      startX: e.clientX,
      startY: e.clientY,
      boxX: box.x,
      boxY: box.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent, defectId: string) {
    const drag = dragState.current
    if (!drag || drag.id !== defectId) return
    const container = containerRefs.current[defectId]
    if (!container) return

    const rect = container.getBoundingClientRect()
    const deltaXPercent = ((e.clientX - drag.startX) / rect.width) * 100
    const deltaYPercent = ((e.clientY - drag.startY) / rect.height) * 100

    setBoxes((prev) => {
      const current = prev[defectId] || DEFAULT_BOX
      const newX = Math.max(0, Math.min(100 - current.width, drag.boxX + deltaXPercent))
      const newY = Math.max(0, Math.min(100 - current.height, drag.boxY + deltaYPercent))
      return { ...prev, [defectId]: { ...current, x: newX, y: newY } }
    })
  }

  function handlePointerUp() {
    dragState.current = null
    resizeState.current = null
  }

  function handleResizeStart(e: React.PointerEvent, defectId: string) {
    e.preventDefault()
    e.stopPropagation()
    const box = boxes[defectId] || DEFAULT_BOX
    resizeState.current = {
      id: defectId,
      startX: e.clientX,
      startY: e.clientY,
      boxW: box.width,
      boxH: box.height,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleResizeMove(e: React.PointerEvent, defectId: string) {
    e.stopPropagation()
    const resize = resizeState.current
    if (!resize || resize.id !== defectId) return
    const container = containerRefs.current[defectId]
    if (!container) return

    const rect = container.getBoundingClientRect()
    const deltaWPercent = ((e.clientX - resize.startX) / rect.width) * 100
    const deltaHPercent = ((e.clientY - resize.startY) / rect.height) * 100

    setBoxes((prev) => {
      const current = prev[defectId] || DEFAULT_BOX
      const newW = Math.max(3, Math.min(100 - current.x, resize.boxW + deltaWPercent))
      const newH = Math.max(3, Math.min(100 - current.y, resize.boxH + deltaHPercent))
      return { ...prev, [defectId]: { ...current, width: newW, height: newH } }
    })
  }

  async function burnBoxIntoPhoto(photoUrl: string, box: BoundingBox): Promise<Blob | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0)

          const boxX = (box.x / 100) * canvas.width
          const boxY = (box.y / 100) * canvas.height
          const boxW = (box.width / 100) * canvas.width
          const boxH = (box.height / 100) * canvas.height

          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = Math.max(3, canvas.width * 0.004)
          ctx.strokeRect(boxX, boxY, boxW, boxH)

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = photoUrl
    })
  }

  async function handleConfirm(defect: Defect) {
    setBusyId(defect.id)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const partnerId = assignedPartner[defect.id] || null
    const newStatus = partnerId ? 'assigned' : 'confirmed'
    const box = boxes[defect.id] || DEFAULT_BOX
    const finalClassification = classification[defect.id] || 'snag'

    let annotatedUrl: string | null = null
    if (defect.photo_url) {
      const blob = await burnBoxIntoPhoto(defect.photo_url, box)
      if (blob) {
        const path = `${defect.project_id}/annotated-${Date.now()}-${defect.id}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('defect-photos')
          .upload(path, blob)
        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('defect-photos').getPublicUrl(path)
          annotatedUrl = publicUrl
        }
      }
    }

    let ncrNumber = defect.ncr_number
    if (finalClassification === 'ncr' && !ncrNumber) {
      const { data: generated } = await supabase.rpc('generate_ncr_number', { pid: defect.project_id })
      ncrNumber = generated || null
    }

    await supabase
      .from('defects')
      .update({
        status: newStatus,
        description: editedText[defect.id],
        assigned_partner_id: partnerId,
        target_close_date: targetDate[defect.id] || null,
        confirmed_at: new Date().toISOString(),
        bounding_box: box,
        annotated_photo_url: annotatedUrl,
        classification: finalClassification,
        ncr_number: ncrNumber,
        root_cause: finalClassification === 'ncr' ? rootCause[defect.id] || null : null,
        corrective_action: finalClassification === 'ncr' ? correctiveAction[defect.id] || null : null,
      })
      .eq('id', defect.id)

    await supabase.from('defect_history').insert({
      defect_id: defect.id,
      changed_by: user?.id,
      old_status: 'draft',
      new_status: newStatus,
    })

    if (partnerId) {
      await supabase.from('notifications').insert({
        user_id: partnerId,
        defect_id: defect.id,
        is_read: false,
        message: `You've been assigned a ${finalClassification === 'ncr' ? 'non-conformance (NCR)' : 'defect'}: ${defect.title || editedText[defect.id]}${
          targetDate[defect.id] ? ` (due ${targetDate[defect.id]})` : ''
        }`,
      })
    }

    setDefects((prev) => prev.filter((d) => d.id !== defect.id))
    setBusyId(null)
  }

  async function handleReject(defect: Defect) {
    setBusyId(defect.id)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase
      .from('defects')
      .update({ status: 'rejected' })
      .eq('id', defect.id)

    await supabase.from('defect_history').insert({
      defect_id: defect.id,
      changed_by: user?.id,
      old_status: 'draft',
      new_status: 'rejected',
      notes: rejectReason || null,
    })

    setDefects((prev) => prev.filter((d) => d.id !== defect.id))
    setBusyId(null)
    setRejectingId(null)
    setRejectReason('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Review Defects" />
        <p className="mt-1 text-sm text-slate-500">
          Confirm or reject each item. Drag the box to reposition, or drag the corner handle to resize - it'll be baked into the photo once confirmed.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Nothing waiting for review right now.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {defects.map((defect) => {
            const box = boxes[defect.id] || DEFAULT_BOX
            const isNcr = classification[defect.id] === 'ncr'
            return (
              <div
                key={defect.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-slate-500">
                  {getProjectName(defect)}
                </p>
                {defect.title && (
                  <p className="mt-1 text-sm font-semibold text-slate-900">{defect.title}</p>
                )}

                {defect.photo_url && (
                  <div
                    ref={(el) => {
                      containerRefs.current[defect.id] = el
                    }}
                    className="relative mt-2 w-full touch-none select-none"
                  >
                    <img
                      src={defect.photo_url}
                      alt="Defect"
                      className="w-full rounded-md"
                      draggable={false}
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, defect.id)}
                      onPointerMove={(e) => handlePointerMove(e, defect.id)}
                      onPointerUp={handlePointerUp}
                      style={{
                        position: 'absolute',
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                        border: '3px solid #ef4444',
                        cursor: 'grab',
                        touchAction: 'none',
                      }}
                    >
                      <span className="absolute -top-6 left-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Drag to adjust
                      </span>
                      <div
                        onPointerDown={(e) => handleResizeStart(e, defect.id)}
                        onPointerMove={(e) => handleResizeMove(e, defect.id)}
                        onPointerUp={handlePointerUp}
                        style={{
                          position: 'absolute',
                          right: -8,
                          bottom: -8,
                          width: 20,
                          height: 20,
                          backgroundColor: '#ef4444',
                          borderRadius: '50%',
                          border: '2px solid white',
                          cursor: 'nwse-resize',
                          touchAction: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {defect.standard_reference && (
                  <p className="mt-2 text-xs text-slate-500">
                    Standard: {defect.standard_reference}
                  </p>
                )}
                {defect.ai_confidence !== null && (
                  <p className="text-xs text-slate-500">
                    AI confidence: {Math.round((defect.ai_confidence || 0) * 100)}%
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">Classification:</label>
                  <div className="flex overflow-hidden rounded-md border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setClassification((prev) => ({ ...prev, [defect.id]: 'snag' }))}
                      className={`px-3 py-1 text-xs font-medium ${
                        !isNcr ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      Snag
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassification((prev) => ({ ...prev, [defect.id]: 'ncr' }))}
                      className={`px-3 py-1 text-xs font-medium ${
                        isNcr ? 'bg-red-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      NCR
                    </button>
                  </div>
                  {defect.ncr_number && (
                    <span className="text-xs font-medium text-red-600">{defect.ncr_number}</span>
                  )}
                </div>

                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={editedText[defect.id] || ''}
                  onChange={(e) =>
                    setEditedText((prev) => ({ ...prev, [defect.id]: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />

                {isNcr && (
                  <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-800">
                      Non-conformance - root cause and corrective action required for closure
                    </p>
                    <label className="mt-2 block text-xs font-medium text-slate-700">Root cause</label>
                    <textarea
                      value={rootCause[defect.id] || ''}
                      onChange={(e) => setRootCause((prev) => ({ ...prev, [defect.id]: e.target.value }))}
                      rows={2}
                      placeholder="Why did this non-conformance occur?"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <label className="mt-2 block text-xs font-medium text-slate-700">Corrective action</label>
                    <textarea
                      value={correctiveAction[defect.id] || ''}
                      onChange={(e) => setCorrectiveAction((prev) => ({ ...prev, [defect.id]: e.target.value }))}
                      rows={2}
                      placeholder="What needs to happen to resolve this and prevent recurrence?"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">Assigned</label>
                  <select
                    value={assignedPartner[defect.id] || ''}
                    onChange={(e) =>
                      setAssignedPartner((prev) => ({ ...prev, [defect.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.company_name || p.full_name || 'Partner'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Target completion
                  </label>
                  <input
                    type="date"
                    value={targetDate[defect.id] || ''}
                    onChange={(e) =>
                      setTargetDate((prev) => ({ ...prev, [defect.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                {rejectingId === defect.id ? (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Why is this not a defect?
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. this is within tolerance, or normal finish for this material"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleReject(defect)}
                        disabled={busyId === defect.id}
                        className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busyId === defect.id ? 'Saving...' : 'Confirm rejection'}
                      </button>
                      <button
                        onClick={() => setRejectingId(null)}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleConfirm(defect)}
                      disabled={busyId === defect.id}
                      className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busyId === defect.id
                        ? 'Saving...'
                        : assignedPartner[defect.id]
                        ? 'Confirm & assign'
                        : 'Confirm defect'}
                    </button>
                    <button
                      onClick={() => setRejectingId(defect.id)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Not a defect
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
