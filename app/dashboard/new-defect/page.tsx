'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

function NewDefectPageInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const initialProjectId = searchParams.get('projectId') || ''
  const initialLocation = searchParams.get('location') || ''
  const initialDrawingId = searchParams.get('drawingId') || ''
  const initialPinX = searchParams.get('pinX')
  const initialPinY = searchParams.get('pinY')

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(initialProjectId)
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedPartnerId, setAssignedPartnerId] = useState('')

  const [location, setLocation] = useState(initialLocation)
  const [drawingId] = useState(initialDrawingId || null)
  const [pinX] = useState(initialPinX ? parseFloat(initialPinX) : null)
  const [pinY] = useState(initialPinY ? parseFloat(initialPinY) : null)
  const [targetDate, setTargetDate] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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

      const { data: projectData } = await supabase
        .from('project_members')
        .select('projects(id, name)')
        .eq('user_id', user.id)

      const projectList = (projectData || []).flatMap((row: any) =>
        Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
      )
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setItems([])
    setSaved(false)
    setError(null)
    setPreview(URL.createObjectURL(selected))
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const result = reader.result as string
          const parts = result.split(',')
          if (parts.length < 2) {
            reject(new Error('File reading step: unexpected file format'))
            return
          }
          resolve(parts[1])
        } catch (err) {
          reject(new Error('File reading step: could not process this file'))
        }
      }
      reader.onerror = () => reject(new Error('File reading step: FileReader failed'))
      reader.readAsDataURL(f)
    })
  }

  async function handleAnalyze() {
    if (!file || !projectId) return
    setAnalyzing(true)
    setError(null)

    try {
      let base64: string
      try {
        base64 = await fileToBase64(file)
      } catch (err: any) {
        setError(`${err?.message || 'Failed to read the photo file.'} (file size: ${Math.round(file.size / 1024)}KB)`)
        return
      }

      let res: Response
      try {
        res = await fetch('/api/analyze-defect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
            projectId,
            location,
          }),
        })
      } catch (err: any) {
        setError(`Request failed to send (payload ~${Math.round(base64.length / 1024)}KB): ${err?.message || 'unknown'}`)
        return
      }

      let result: any
      try {
        result = await res.json()
      } catch (err: any) {
        setError(`Server did not return valid JSON (status ${res.status}): ${err?.message || 'unknown'}`)
        return
      }

      if (!res.ok) {
        setError(`Analysis failed: ${result.error || res.status}`)
        return
      }

      if (!result.defects || result.defects.length === 0) {
        setItems([])
        setError('No defects were spotted in that photo.')
        return
      }

      const mapped: ReviewItem[] = result.defects.map((d: DetectedDefect, i: number) => ({
        ...d,
        localId: `${Date.now()}-${i}`,
        title: `Defect ${i + 1}`,
        included: true,
      }))
      setItems(mapped)
    } catch (err: any) {
      setError(`Unexpected error (outer): ${err?.message || 'unknown'}`)
    } finally {
      setAnalyzing(false)
    }
  }

  function updateItem(localId: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)))
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
        drawing_id: drawingId,
        pin_x: pinX,
        pin_y: pinY,
        photo_url: publicUrl,
        ai_description: it.description,
        ai_confidence: it.confidence,
        standard_reference: it.standard_reference,
        description: it.description,
        bounding_box: it.box,
        assigned_partner_id: assignedPartnerId || null,
        target_close_date: targetDate || null,
        status: 'draft',
        created_by: user.id,
      }))

      const { error: insertError } = await supabase.from('defects').insert(rows)
      if (insertError) {
        setError(`Save failed: ${insertError.message}`)
        setSaving(false)
        return
      }

      setSaved(true)
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">New Defect</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyze a photo - the AI will highlight each defect it finds for you to approve.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Location</label>
              {projectId && (
                <Link
                  href={`/dashboard/drawings?projectId=${projectId}`}
                  className="text-xs font-medium text-slate-900 underline"
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {drawingId && (
              <p className="mt-1 text-xs text-slate-500">Pinned location attached from drawing.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mt-1 w-full text-sm"
            />
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

          {file && items.length === 0 && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !projectId}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze photo'}
            </button>
          )}

          {items.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                {items.length} defect{items.length > 1 ? 's' : ''} found - review below
              </p>
              {items.map((it, i) => (
                <div
                  key={it.localId}
                  className="rounded-lg border border-slate-200 p-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: BOX_COLORS[i % BOX_COLORS.length] }}
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={it.title}
                      onChange={(e) => updateItem(it.localId, { title: e.target.value })}
                      className="w-2/3 rounded-md border border-slate-300 px-2 py-1 text-sm font-medium"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={it.included}
                        onChange={(e) => updateItem(it.localId, { included: e.target.checked })}
                      />
                      Include
                    </label>
                  </div>
                  <textarea
                    value={it.description}
                    onChange={(e) => updateItem(it.localId, { description: e.target.value })}
                    rows={2}
                    className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Confidence: {Math.round(it.confidence * 100)}%
                    {it.standard_reference && ` · Standard: ${it.standard_reference}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Assigned</label>
            <select
              value={assignedPartnerId}
              onChange={(e) => setAssignedPartnerId(e.target.value)}
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

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">
                Date created
              </label>
              <p className="mt-1 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
                {todayLabel}
              </p>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">
                Target completion
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {!saved ? (
            <button
              onClick={handleSave}
              disabled={saving || items.filter((i) => i.included).length === 0}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save selected defects'}
            </button>
          ) : (
            <p className="text-sm font-medium text-green-600">
              Saved. You can review them on the dashboard.
            </p>
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
        <div className="min-h-screen bg-slate-50 p-8">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <NewDefectPageInner />
    </Suspense>
  )
}
