'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import ClauseViewer from '@/components/ClauseViewer'
import PolygonBoxEditor, { Point } from '@/components/PolygonBoxEditor'


type Partner = { id: string; full_name: string | null; company_name: string | null }

// bounding_box on existing defects may still be the old rectangle shape
// ({x,y,width,height}) saved before polygons were introduced - normalizeToPolygon()
// below converts either shape into a Point[] the editor can work with.
type LegacyRect = { x: number; y: number; width: number; height: number }

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
  assigned_company_name: string | null
  target_close_date: string | null
  bounding_box: LegacyRect | Point[] | null
  classification: string | null
  ncr_number: string | null
  element_type: string | null
  root_cause: string | null
  corrective_action: string | null
  projects:
    | { name: string; company_name: string | null; country: string | null }
    | { name: string; company_name: string | null; country: string | null }[]
    | null
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

const DEFAULT_POLYGON: Point[] = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 65 },
  { x: 35, y: 65 },
]

function normalizeToPolygon(box: LegacyRect | Point[] | null): Point[] {
  if (!box) return DEFAULT_POLYGON
  if (Array.isArray(box)) {
    return box.length >= 3 ? box : DEFAULT_POLYGON
  }
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ]
}

export default function ReviewDefectsPage() {
  const supabase = createClient()

  const [defects, setDefects] = useState<Defect[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [editedText, setEditedText] = useState<Record<string, string>>({})
  const [assignedPartner, setAssignedPartner] = useState<Record<string, string>>({})
  const [targetDate, setTargetDate] = useState<Record<string, string>>({})
  const [boxes, setBoxes] = useState<Record<string, Point[]>>({})
  const [classification, setClassification] = useState<Record<string, string>>({})
  const [rootCause, setRootCause] = useState<Record<string, string>>({})
  const [correctiveAction, setCorrectiveAction] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadDefects()
  }, [])

  async function loadDefects() {
    setLoading(true)
    const { data } = await supabase
      .from('defects')
      .select(
        'id, project_id, title, photo_url, ai_description, ai_confidence, standard_reference, description, assigned_partner_id, assigned_company_name, target_close_date, bounding_box, classification, ncr_number, element_type, root_cause, corrective_action, projects(name, company_name, country)'
      )
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    const list = (data || []) as unknown as Defect[]
    setDefects(list)

    const initialText: Record<string, string> = {}
    const initialPartner: Record<string, string> = {}
    const initialDate: Record<string, string> = {}
    const initialBoxes: Record<string, Point[]> = {}
    const initialClass: Record<string, string> = {}
    const initialRootCause: Record<string, string> = {}
    const initialCorrective: Record<string, string> = {}
    list.forEach((d) => {
      initialText[d.id] = d.description || d.ai_description || ''
      initialPartner[d.id] = d.assigned_company_name || ''
      initialDate[d.id] = d.target_close_date || ''
      initialBoxes[d.id] = normalizeToPolygon(d.bounding_box)
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

  function getProject(d: Defect) {
    if (!d.projects) return null
    return Array.isArray(d.projects) ? d.projects[0] : d.projects
  }

  // Best-effort: a confirmed defect is real, validated evidence of what a
  // defect looks like, so every confirm feeds it straight into the shared
  // knowledge base used to calibrate future AI analysis - private to this
  // defect's own company by default (see defect_knowledge_base RLS). Never
  // throws - failing to log this shouldn't block or fail the confirm itself.
  async function addConfirmedDefectToKnowledgeBase(
    defect: Defect,
    description: string,
    classification: string,
    photoUrl: string | null,
    correctiveActionText: string | null,
    userId: string | undefined
  ) {
    try {
      const project = getProject(defect)
      if (!description.trim()) return

      await supabase.from('defect_knowledge_base').insert({
        title: description.slice(0, 100),
        element_type: defect.element_type,
        country: project?.country || null,
        applicable_standards: null,
        defect_description: description,
        correct_reference: correctiveActionText || null,
        severity_default: classification,
        active: true,
        photo_url: photoUrl,
        created_by: userId || null,
        source: 'project',
        source_defect_id: defect.id,
        company_name: project?.company_name || null,
      })
    } catch {
      // Non-critical - the defect is already confirmed either way.
    }
  }

  // Guards any network call that could otherwise hang the confirm button forever with no
  // feedback (e.g. a stuck Postgres lock on an RPC) - rejects after `ms` so it always
  // resolves one way or another.
  function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms)
      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (err) => {
          clearTimeout(timer)
          reject(err)
        }
      )
    })
  }

  async function burnPolygonIntoPhoto(photoUrl: string, points: Point[]): Promise<Blob | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        clearTimeout(timer)
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

          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = Math.max(3, canvas.width * 0.004)
          ctx.beginPath()
          points.forEach((p, i) => {
            const px = (p.x / 100) * canvas.width
            const py = (p.y / 100) * canvas.height
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          ctx.closePath()
          ctx.stroke()

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }
      img.src = photoUrl
    })
  }

  // Falls back to scanning existing numbers for this project+classification and taking the
  // max + 1 - the same approach used before the atomic RPC existed. Less safe against two
  // defects being confirmed at the exact same instant, but only used when the RPC below
  // fails or times out, so confirming a defect can never get permanently stuck.
  async function generateReferenceNumberFallback(projectId: string, cls: string) {
    const prefix = cls === 'ncr' ? 'NCR' : 'SNAG'
    const { data } = await supabase
      .from('defects')
      .select('ncr_number')
      .eq('project_id', projectId)
      .eq('classification', cls)
      .not('ncr_number', 'is', null)

    let maxNumber = 0
    ;(data || []).forEach((row: { ncr_number: string | null }) => {
      const match = row.ncr_number?.match(/(\d+)$/)
      if (match) maxNumber = Math.max(maxNumber, parseInt(match[1], 10))
    })

    return `${prefix}${String(maxNumber + 1).padStart(3, '0')}`
  }

  // Assigns a project-scoped, classification-scoped reference code (SNAG001, SNAG002... /
  // NCR001, NCR002...) via a database-side atomic counter, so two defects confirmed at the
  // same instant can never be handed the same number. Guarded with a timeout + fallback so a
  // stuck database-side lock can never hang the confirm button forever.
  async function generateReferenceNumber(projectId: string, cls: string) {
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase.rpc('generate_reference_number', {
            p_project_id: projectId,
            p_classification: cls,
          })
        ),
        10000,
        'Timed out generating a reference number'
      )
      if (error) throw error
      if (!data) throw new Error('No reference number returned')
      return data as string
    } catch {
      return generateReferenceNumberFallback(projectId, cls)
    }
  }

  async function handleConfirm(defect: Defect) {
    setBusyId(defect.id)
    setActionErrors((prev) => {
      const next = { ...prev }
      delete next[defect.id]
      return next
    })

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const companyName = assignedPartner[defect.id] || null
      const companyPartners = companyName ? partners.filter((p) => p.company_name === companyName) : []
      const partnerId = companyPartners[0]?.id || null
      const newStatus = companyName ? 'assigned' : 'confirmed'
      const box = boxes[defect.id] || DEFAULT_POLYGON
      const finalClassification = classification[defect.id] || 'snag'

      let annotatedUrl: string | null = null
      if (defect.photo_url) {
        const blob = await burnPolygonIntoPhoto(defect.photo_url, box)
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

      const referenceNumber =
        defect.ncr_number || (await generateReferenceNumber(defect.project_id, finalClassification))

      const { error: updateError } = await supabase
        .from('defects')
        .update({
          status: newStatus,
          description: editedText[defect.id],
          assigned_partner_id: partnerId,
          assigned_company_name: companyName,
          target_close_date: targetDate[defect.id] || null,
          confirmed_at: new Date().toISOString(),
          bounding_box: box,
          annotated_photo_url: annotatedUrl,
          classification: finalClassification,
          ncr_number: referenceNumber,
          root_cause: finalClassification === 'ncr' ? rootCause[defect.id] || null : null,
          corrective_action: finalClassification === 'ncr' ? correctiveAction[defect.id] || null : null,
        })
        .eq('id', defect.id)
      if (updateError) throw updateError

      await supabase.from('defect_history').insert({
        defect_id: defect.id,
        changed_by: user?.id,
        old_status: 'draft',
        new_status: newStatus,
      })

      await addConfirmedDefectToKnowledgeBase(
        defect,
        editedText[defect.id] || defect.ai_description || '',
        finalClassification,
        annotatedUrl || defect.photo_url,
        finalClassification === 'ncr' ? correctiveAction[defect.id] || null : null,
        user?.id
      )

      if (companyPartners.length > 0) {
        const message = `Your company has been assigned a ${finalClassification === 'ncr' ? 'non-conformance (NCR)' : 'defect'}: ${defect.title || editedText[defect.id]}${
          targetDate[defect.id] ? ` (due ${targetDate[defect.id]})` : ''
        }`
        await supabase.from('notifications').insert(
          companyPartners.map((p) => ({
            user_id: p.id,
            defect_id: defect.id,
            is_read: false,
            message,
          }))
        )
      }

      setDefects((prev) => prev.filter((d) => d.id !== defect.id))
    } catch (err: any) {
      setActionErrors((prev) => ({
        ...prev,
        [defect.id]: err?.message || 'Could not confirm this defect - please try again.',
      }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(defect: Defect) {
    setBusyId(defect.id)
    setActionErrors((prev) => {
      const next = { ...prev }
      delete next[defect.id]
      return next
    })

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error: updateError } = await supabase
        .from('defects')
        .update({ status: 'rejected' })
        .eq('id', defect.id)
      if (updateError) throw updateError

      await supabase.from('defect_history').insert({
        defect_id: defect.id,
        changed_by: user?.id,
        old_status: 'draft',
        new_status: 'rejected',
        notes: rejectReason || null,
      })

      setDefects((prev) => prev.filter((d) => d.id !== defect.id))
      setRejectingId(null)
      setRejectReason('')
    } catch (err: any) {
      setActionErrors((prev) => ({
        ...prev,
        [defect.id]: err?.message || 'Could not reject this defect - please try again.',
      }))
    } finally {
      setBusyId(null)
    }
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
        <PageHeader title="Review Defects" />
        <p className="mt-1 text-sm text-deck-dim">
          Confirm or reject each item. Drag a point to reshape the outline, tap an edge to add a point, or double-tap a point to remove it - it'll be baked into the photo once confirmed.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">
            Nothing waiting for review right now.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {defects.map((defect) => {
            const box = boxes[defect.id] || DEFAULT_POLYGON
            const isNcr = classification[defect.id] === 'ncr'
            return (
              <div
                key={defect.id}
                className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-deck-dim">
                  {getProjectName(defect)}
                </p>
                {defect.title && (
                  <p className="mt-1 text-sm font-semibold text-deck-text">{defect.title}</p>
                )}

                {defect.photo_url && (
                  <div className="relative mt-2 w-full select-none">
                    <img
                      src={defect.photo_url}
                      alt="Defect"
                      className="w-full rounded-md"
                      draggable={false}
                    />
                    <PolygonBoxEditor
                      points={box}
                      onChange={(next) => setBoxes((prev) => ({ ...prev, [defect.id]: next }))}
                    />
                  </div>
                )}

                              {defect.standard_reference && (
                  <>
                    <p className="mt-2 text-xs text-deck-dim">
                      Standard: {defect.standard_reference}
                    </p>
                    <ClauseViewer projectId={defect.project_id} standardReference={defect.standard_reference} />
                  </>
                )}

                {defect.ai_confidence !== null && (
                  <p className="text-xs text-deck-dim">
                    AI confidence: {Math.round((defect.ai_confidence || 0) * 100)}%
                  </p>
                )}
                {defect.element_type && (
                  <p className="text-xs text-deck-dim">
                    AI identified element:{' '}
                    <span className="font-medium text-deck-body">
                      {ELEMENT_TYPE_LABELS[defect.element_type] || defect.element_type}
                    </span>
                    {' '}- check this matches the photo
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-deck-body">Classification:</label>
                  <div className="flex overflow-hidden rounded-md border border-deck-border">
                    <button
                      type="button"
                      onClick={() => setClassification((prev) => ({ ...prev, [defect.id]: 'snag' }))}
                      className={`px-3 py-1 text-xs font-medium ${
                        !isNcr ? 'bg-deck-accent text-deck-bg' : 'bg-deck-surface text-deck-body'
                      }`}
                    >
                      Snag
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassification((prev) => ({ ...prev, [defect.id]: 'ncr' }))}
                      className={`px-3 py-1 text-xs font-medium ${
                        isNcr ? 'bg-red-600 text-white' : 'bg-deck-surface text-deck-body'
                      }`}
                    >
                      NCR
                    </button>
                  </div>
                  {defect.ncr_number && (
                    <span className={`text-xs font-medium ${isNcr ? 'text-red-600' : 'text-deck-accent'}`}>
                      {defect.ncr_number}
                    </span>
                  )}
                </div>

                <label className="mt-3 block text-sm font-medium text-deck-body">
                  Description
                </label>
                <textarea
                  value={editedText[defect.id] || ''}
                  onChange={(e) =>
                    setEditedText((prev) => ({ ...prev, [defect.id]: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                />

                {isNcr && (
                  <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-600">
                      Non-conformance - root cause and corrective action required for closure
                    </p>
                    <label className="mt-2 block text-xs font-medium text-deck-body">Root cause</label>
                    <textarea
                      value={rootCause[defect.id] || ''}
                      onChange={(e) => setRootCause((prev) => ({ ...prev, [defect.id]: e.target.value }))}
                      rows={2}
                      placeholder="Why did this non-conformance occur?"
                      className="mt-1 w-full rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <label className="mt-2 block text-xs font-medium text-deck-body">Corrective action</label>
                    <textarea
                      value={correctiveAction[defect.id] || ''}
                      onChange={(e) => setCorrectiveAction((prev) => ({ ...prev, [defect.id]: e.target.value }))}
                      rows={2}
                      placeholder="What needs to happen to resolve this and prevent recurrence?"
                      className="mt-1 w-full rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <label className="block text-sm font-medium text-deck-body">Assign to company</label>
                  <select
                    value={assignedPartner[defect.id] || ''}
                    onChange={(e) =>
                      setAssignedPartner((prev) => ({ ...prev, [defect.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                  >
                    <option value="">Unassigned</option>
                    {Array.from(new Set(partners.map((p) => p.company_name).filter(Boolean))).map((c) => (
                      <option key={c as string} value={c as string}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-deck-dim">
                    Everyone at the chosen company will be notified.
                  </p>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-deck-body">
                    Target completion
                  </label>
                  <input
                    type="date"
                    value={targetDate[defect.id] || ''}
                    onChange={(e) =>
                      setTargetDate((prev) => ({ ...prev, [defect.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                  />
                </div>

                {actionErrors[defect.id] && (
                  <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-600">
                    {actionErrors[defect.id]}
                  </p>
                )}

                {rejectingId === defect.id ? (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-deck-body">
                      Why is this not a defect?
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
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
                        className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body"
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
                      className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                    >
                      {busyId === defect.id
                        ? 'Saving...'
                        : assignedPartner[defect.id]
                        ? 'Confirm & assign'
                        : 'Confirm defect'}
                    </button>
                    <button
                      onClick={() => setRejectingId(defect.id)}
                      className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body"
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
