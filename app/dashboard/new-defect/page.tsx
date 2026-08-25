'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import MeasurementFields, { MeasurementData } from '@/components/MeasurementFields'
import ClauseViewer from '@/components/ClauseViewer'
import CameraCapture, { OrientationHint } from '@/components/CameraCapture'
import { useActiveInspection } from '@/components/ActiveInspectionContext'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  requires_measurement: boolean
  classification: 'snag' | 'ncr'
  classification_reason: string
  element_type: string
  box: { x: number; y: number; width: number; height: number }
  level_abbrev: string
  headline: string
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

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
  measurement: MeasurementData
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
const ESTIMATED_ANALYSIS_SECONDS = 18
const EMPTY_MEASUREMENT: MeasurementData = { measuredGapMm: '', testedDetailReference: '', manufacturerSystem: '' }

function NewDefectPageInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { activeInspection, getCurrentPositionForPhoto } = useActiveInspection()

  const initialProjectId = searchParams.get('projectId') || ''
  const initialLocation = searchParams.get('location') || ''
  const initialDrawingId = searchParams.get('drawingId') || ''
  const initialPinX = searchParams.get('pinX')
  const initialPinY = searchParams.get('pinY')

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(initialProjectId)
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedCompany, setAssignedCompany] = useState('')

  const [location, setLocation] = useState(initialLocation)
  const [finishGrade, setFinishGrade] = useState('')
  const [drawingId] = useState(initialDrawingId || null)
  const [pinX] = useState(initialPinX ? parseFloat(initialPinX) : null)
  const [pinY] = useState(initialPinY ? parseFloat(initialPinY) : null)
  const [targetDate, setTargetDate] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [orientationHint, setOrientationHint] = useState<OrientationHint | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single()

      let projectList: Project[]
      if (profile?.is_platform_admin) {
        const { data: allProjects } = await supabase.from('projects').select('id, name')
        projectList = allProjects || []
      } else {
        const { data: projectData } = await supabase
          .from('project_members')
          .select('projects(id, name)')
          .eq('user_id', user.id)

        projectList = (projectData || []).flatMap((row: any) =>
          Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
        )
      }
      setProjects(projectList)

      if (initialProjectId && projectList.some((p: Project) => p.id === initialProjectId)) {
        setProjectId(initialProjectId)
      } else if (projectList.length > 0) {
        setProjectId(projectList[0].id)
      }

      const { data: partnerData } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .eq('role', 'partner')

      setPartners(partnerData || [])
    }
    loadData()
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  function startProgressSimulation() {
    setAnalyzeProgress(0)
    setElapsedSeconds(0)
    const startTime = Date.now()

    progressTimerRef.current = setInterval(() => {
      const secondsPassed = (Date.now() - startTime) / 1000
      setElapsedSeconds(Math.round(secondsPassed))

      const estimatedPercent = (secondsPassed / ESTIMATED_ANALYSIS_SECONDS) * 100
      const capped = Math.min(estimatedPercent, 92)
      setAnalyzeProgress(capped)
    }, 200)
  }

  function stopProgressSimulation(finished: boolean) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (finished) {
      setAnalyzeProgress(100)
      setTimeout(() => setAnalyzeProgress(0), 600)
    } else {
      setAnalyzeProgress(0)
    }
  }

  function applySelectedFile(selected: File, orientation: OrientationHint | null) {
    setFile(selected)
    setOrientationHint(orientation)
    setItems([])
    setSaved(false)
    setError(null)
    setDuplicateWarning(null)
    setPreview(URL.createObjectURL(selected))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    // Photo picked from the gallery rather than taken live - no orientation-at-capture signal available.
    applySelectedFile(selected, null)
  }

  function handleCameraCapture(captured: File, orientation: OrientationHint | null) {
    setShowCamera(false)
    applySelectedFile(captured, orientation)
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(f)

      img.onload = () => {
        try {
          const maxDimension = 1600
          let { width, height } = img

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not process image (no canvas context)'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const parts = dataUrl.split(',')
          if (parts.length < 2) {
            reject(new Error('File reading step: unexpected file format'))
            return
          }
          URL.revokeObjectURL(objectUrl)
          resolve(parts[1])
        } catch (err) {
          reject(new Error('File reading step: could not process this file'))
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('File reading step: could not load this image'))
      }

      img.src = objectUrl
    })
  }

  async function handleAnalyze() {
    if (!file || !projectId) return
    setAnalyzing(true)
    setError(null)
    setDuplicateWarning(null)
    startProgressSimulation()

    try {
      let base64: string
      try {
        base64 = await fileToBase64(file)
      } catch (err: any) {
        setError(`${err?.message || 'Failed to read the photo file.'} (file size: ${Math.round(file.size / 1024)}KB)`)
        stopProgressSimulation(false)
        return
      }

      let res: Response
      try {
        res = await fetch('/api/analyze-defect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: 'image/jpeg',
            projectId,
            location,
            finishGrade,
            orientationHint,
          }),
        })
      } catch (err: any) {
        setError(`Request failed to send (payload ~${Math.round(base64.length / 1024)}KB): ${err?.message || 'unknown'}`)
        stopProgressSimulation(false)
        return
      }

      let result: any
      try {
        result = await res.json()
      } catch (err: any) {
        setError(`Server did not return valid JSON (status ${res.status}): ${err?.message || 'unknown'}`)
        stopProgressSimulation(false)
        return
      }

      if (!res.ok) {
        setError(`Analysis failed: ${result.error || res.status}`)
        stopProgressSimulation(false)
        return
      }

      if (!result.defects || result.defects.length === 0) {
        setItems([])
        setError('No defects were spotted in that photo.')
        stopProgressSimulation(true)
        return
      }

      const { count: existingCount } = await supabase
        .from('defects')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)

      const mapped: ReviewItem[] = result.defects.map((d: DetectedDefect, i: number) => {
        const seq = String((existingCount || 0) + i + 1).padStart(2, '0')
        const title = d.headline
          ? `${d.level_abbrev ? `${d.level_abbrev} ` : ''}${seq} ${d.headline}`
          : `Defect ${(existingCount || 0) + i + 1}`
        return {
          ...d,
          localId: `${Date.now()}-${i}`,
          title,
          included: true,
          measurement: { ...EMPTY_MEASUREMENT },
        }
      })
      setItems(mapped)
      stopProgressSimulation(true)

      try {
        const dupRes = await fetch('/api/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', projectId }),
        })
        const dupResult = await dupRes.json()
        if (dupResult.isDuplicate) {
          setDuplicateWarning(dupResult.reason || 'This may already be logged as an open defect on this project.')
        }
      } catch {
        // duplicate check is a soft feature - fail silently if it errors
      }
    } catch (err: any) {
      setError(`Unexpected error (outer): ${err?.message || 'unknown'}`)
      stopProgressSimulation(false)
    } finally {
      setAnalyzing(false)
    }
  }

  function updateItem(localId: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)))
  }

  function updateMeasurement(localId: string, patch: Partial<MeasurementData>) {
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId ? { ...it, measurement: { ...it.measurement, ...patch } } : it
      )
    )
  }

  async function handleSave() {
    const included = items.filter((it) => it.included)
    if (!file || !projectId || included.length === 0) {
      setError('Select at least one defect to save.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const companyPartners = assignedCompany ? partners.filter((p) => p.company_name === assignedCompany) : []
      const partnerId = companyPartners[0]?.id || null

      const geoTag =
        activeInspection?.projectId === projectId ? await getCurrentPositionForPhoto() : null

      const filePath = `${projectId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('defect-photos')
        .upload(filePath, file)
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setSaving(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('defect-photos').getPublicUrl(filePath)

      const rows = included.map((it) => ({
        project_id: projectId,
        title: it.title,
        location,
        finish_grade: finishGrade || null,
        drawing_id: drawingId,
        pin_x: pinX,
        pin_y: pinY,
        photo_url: publicUrl,
        ai_description: it.description,
        ai_confidence: it.confidence,
        standard_reference: it.standard_reference,
        description: it.description,
        bounding_box: it.box,
        requires_measurement: it.requires_measurement,
        classification: it.classification,
        element_type: it.element_type || null,
        measured_gap_mm: it.measurement.measuredGapMm ? parseFloat(it.measurement.measuredGapMm) : null,
        tested_detail_reference: it.measurement.testedDetailReference || null,
        manufacturer_system: it.measurement.manufacturerSystem || null,
        // Pre-fills the reviewer's assignment picker on the /review confirm screen -
        // the actual "assigned" status flip and notification happen there, not here.
        assigned_partner_id: partnerId,
        assigned_company_name: assignedCompany || null,
        target_close_date: targetDate || null,
        status: 'draft',
        created_by: user.id,
        inspection_id: activeInspection?.projectId === projectId ? activeInspection.id : null,
        photo_lat: geoTag?.lat ?? null,
        photo_lng: geoTag?.lng ?? null,
        photo_accuracy_m: geoTag?.accuracyM ?? null,
        photo_level_label: activeInspection?.projectId === projectId ? activeInspection.levelLabel || null : null,
      }))

      const { error: insertError } = await supabase.from('defects').insert(rows)
      if (insertError) {
        setError(`Save failed: ${insertError.message}`)
        setSaving(false)
        return
      }

      setSaved(true)
      setTimeout(() => {
        setFile(null)
        setPreview(null)
        setOrientationHint(null)
        setItems([])
        setLocation('')
        setFinishGrade('')
        setTargetDate('')
        setAssignedCompany('')
        setDuplicateWarning(null)
        setSaved(false)
        setError(null)
      }, 1200)
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
      <div className="mx-auto max-w-md">
        <PageHeader title="New Defect" />
        <p className="mt-1 text-sm text-deck-dim">
          Analyze a photo - the AI will highlight each defect it finds for you to approve.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-deck-body">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Specified finish/quality grade</label>
            <input
              type="text"
              value={finishGrade}
              onChange={(e) => setFinishGrade(e.target.value)}
              placeholder="e.g. SR1 exposed floor finish, or FM2 plant room slab"
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
            <p className="mt-1 text-xs text-deck-dim">
              Critical for concrete/finish work - tells the AI what level of imperfection is actually acceptable here.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-deck-body">Location</label>
              {projectId && (
                <Link
                  href={`/dashboard/drawings?projectId=${projectId}`}
                  className="text-xs font-medium text-deck-text underline"
                >
                  Choose on drawing
                </Link>
              )}
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Block A, Level 2, Room 214"
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
            {drawingId && (
              <p className="mt-1 text-xs text-deck-dim">Pinned location attached from drawing.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Photo</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
              >
                Take photo
              </button>
              <label className="flex-1 cursor-pointer rounded-md border border-deck-border px-3 py-2 text-center text-sm font-medium text-deck-text">
                Choose from library
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {orientationHint && (
              <p className="mt-1 text-xs text-deck-dim">
                Camera orientation captured - will be used as a supporting signal for analysis.
              </p>
            )}
          </div>

          {preview && (
            <div className="relative w-full">
              <img src={preview} alt="Preview" className="w-full rounded-md" />
              {items.map((it, i) => (
                <div
                  key={it.localId}
                  style={{
                    position: 'absolute',
                    left: `${it.box.x}%`,
                    top: `${it.box.y}%`,
                    width: `${it.box.width}%`,
                    height: `${it.box.height}%`,
                    border: `2px solid ${BOX_COLORS[i % BOX_COLORS.length]}`,
                    opacity: it.included ? 1 : 0.3,
                  }}
                >
                  <span
                    style={{ backgroundColor: BOX_COLORS[i % BOX_COLORS.length] }}
                    className="absolute -top-5 left-0 rounded px-1 text-[10px] font-semibold text-white"
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {file && items.length === 0 && !analyzing && (
            <button
              onClick={handleAnalyze}
              disabled={!projectId}
              className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              Analyze photo
            </button>
          )}

          {analyzing && (
            <div className="rounded-lg border border-deck-border bg-deck-raised p-3">
              <p className="text-sm font-medium text-deck-body">Analyzing photo...</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-deck-raised">
                <div
                  className="h-2 bg-deck-accent transition-all duration-200"
                  style={{ width: `${analyzeProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-deck-dim">
                {elapsedSeconds}s elapsed - usually takes around {ESTIMATED_ANALYSIS_SECONDS}s, keep this tab open
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-3">
              {duplicateWarning && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700">
                    Possible duplicate - {duplicateWarning}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Check whether this is already logged before saving again.
                  </p>
                </div>
              )}
              <p className="text-sm font-medium text-deck-body">
                {items.length} defect{items.length > 1 ? 's' : ''} found - review below
              </p>
              {items.map((it, i) => (
                <div
                  key={it.localId}
                  className="rounded-lg border border-deck-border p-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: BOX_COLORS[i % BOX_COLORS.length] }}
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={it.title}
                      onChange={(e) => updateItem(it.localId, { title: e.target.value })}
                      className="w-2/3 rounded-md border border-deck-border px-2 py-1 text-sm font-medium bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <label className="flex items-center gap-1 text-xs text-deck-body">
                      <input
                        type="checkbox"
                        checked={it.included}
                        onChange={(e) => updateItem(it.localId, { included: e.target.checked })}
                      />
                      Approve
                    </label>
                  </div>
                  <textarea
                    value={it.description}
                    onChange={(e) => updateItem(it.localId, { description: e.target.value })}
                    rows={6}
                    className="mt-2 w-full resize-y overflow-y-auto rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                  />
                  <p className="mt-1 text-xs text-deck-dim">
                    Confidence: {Math.round(it.confidence * 100)}%
                    {it.standard_reference && ` · Standard: ${it.standard_reference}`}
                  </p>
                  {it.element_type && (
                    <p className="mt-1 text-xs text-deck-dim">
                      AI identified element:{' '}
                      <span className="font-medium text-deck-body">
                        {ELEMENT_TYPE_LABELS[it.element_type] || it.element_type}
                      </span>
                      {' '}- check this matches the photo
                    </p>
                  )}
                  {it.standard_reference && (
                    <ClauseViewer projectId={projectId} standardReference={it.standard_reference} />
                  )}


                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs font-medium text-deck-body">Classification:</label>
                    <div className="flex overflow-hidden rounded-md border border-deck-border">
                      <button
                        type="button"
                        onClick={() => updateItem(it.localId, { classification: 'snag' })}
                        className={`px-3 py-1 text-xs font-medium ${
                          it.classification === 'snag'
                            ? 'bg-deck-accent text-deck-bg'
                            : 'bg-deck-surface text-deck-body'
                        }`}
                      >
                        Snag
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(it.localId, { classification: 'ncr' })}
                        className={`px-3 py-1 text-xs font-medium ${
                          it.classification === 'ncr'
                            ? 'bg-red-600 text-white'
                            : 'bg-deck-surface text-deck-body'
                        }`}
                      >
                        NCR
                      </button>
                    </div>
                  </div>
                  {it.classification_reason && (
                    <p className="mt-1 text-xs italic text-deck-dim">{it.classification_reason}</p>
                  )}

                  {it.requires_measurement && (
                    <MeasurementFields
                      data={it.measurement}
                      onChange={(patch) => updateMeasurement(it.localId, patch)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {items.length > 0 && items.every((it) => !it.included) && (
            <p className="text-sm text-deck-dim">
              Approve at least one defect description above to assign it and set a completion date.
            </p>
          )}

          {items.some((it) => it.included) && (
            <>
              <div>
                <label className="block text-sm font-medium text-deck-body">Assign to company</label>
                <select
                  value={assignedCompany}
                  onChange={(e) => setAssignedCompany(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                >
                  <option value="">Unassigned</option>
                  {Array.from(new Set(partners.map((p) => p.company_name).filter(Boolean))).map((c) => (
                    <option key={c as string} value={c as string}>{c}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-deck-dim">
                  Confirmed on the review screen, where the company is notified.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-deck-body">
                    Date created
                  </label>
                  <p className="mt-1 rounded-md bg-deck-raised px-3 py-2 text-sm text-deck-dim">
                    {todayLabel}
                  </p>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-deck-body">
                    Target completion
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                  />
                </div>
              </div>

              {!saved ? (
                <button
                  onClick={handleSave}
                  disabled={saving || items.filter((i) => i.included).length === 0}
                  className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save selected defects'}
                </button>
              ) : (
                <p className="text-sm font-medium text-emerald-700">
                  Saved. Ready for the next one.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewDefectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewDefectPageInner />
    </Suspense>
  )
}
