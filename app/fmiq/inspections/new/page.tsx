'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture, { OrientationHint } from '@/components/CameraCapture'
import PolygonBoxEditor, { Point } from '@/components/PolygonBoxEditor'

type Asset = { id: string; name: string }

type RectBox = { x: number; y: number; width: number; height: number }

type Finding = {
  localId: string
  description: string
  confidence: number
  regulation_reference: string
  severity: 'minor' | 'moderate' | 'major' | 'hazard'
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  box: RectBox | Point[]
  included: boolean
  isManual: boolean
}

const DEFAULT_POLYGON: Point[] = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 65 },
  { x: 35, y: 65 },
]

const SEVERITY_OPTIONS: Finding['severity'][] = ['minor', 'moderate', 'major', 'hazard']

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'bg-deck-raised text-deck-dim',
  moderate: 'bg-amber-100 text-amber-700',
  major: 'bg-orange-100 text-orange-700',
  hazard: 'bg-red-100 text-red-700',
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

function NewInspectionInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialAssetId = searchParams.get('assetId') || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetId, setAssetId] = useState(initialAssetId)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const [showCamera, setShowCamera] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [orientationHint, setOrientationHint] = useState<OrientationHint | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
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
    if (!initialAssetId && assetData && assetData.length > 0) setAssetId(assetData[0].id)
  }

  async function handleStart() {
    if (!assetId) return
    setStarting(true)
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
      setStarting(false)
      return
    }

    const { data: inspection, error: insertError } = await supabase
      .from('fmiq_inspections')
      .insert({
        asset_id: assetId,
        company_name: profile.company_name,
        inspector_id: user.id,
      })
      .select()
      .single()

    if (insertError || !inspection) {
      setError(`Could not start the inspection: ${insertError?.message || 'unknown error'}`)
      setStarting(false)
      return
    }

    setInspectionId(inspection.id)
    setStarting(false)
  }

  function applySelectedFile(selected: File, orientation: OrientationHint | null) {
    setFile(selected)
    setOrientationHint(orientation)
    setFindings([])
    setError(null)
    setPreview(URL.createObjectURL(selected))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
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
            reject(new Error('Could not process image'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          URL.revokeObjectURL(objectUrl)
          resolve(dataUrl.split(',')[1])
        } catch (err) {
          reject(new Error('Could not process this file'))
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not load this image'))
      }
      img.src = objectUrl
    })
  }

  async function handleAnalyze() {
    if (!file || !assetId) return
    setAnalyzing(true)
    setError(null)

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/fmiq/analyze-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', assetId, orientationHint }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(`Analysis failed: ${result.error || res.status}`)
        return
      }

      if (!result.findings || result.findings.length === 0) {
        setFindings([])
        setError('No issues were spotted in that photo.')
        return
      }

      const mapped: Finding[] = result.findings.map((f: any, i: number) => ({
        ...f,
        localId: `${Date.now()}-${i}`,
        included: true,
        isManual: false,
      }))
      setFindings(mapped)
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleAddManual() {
    setError(null)
    setFindings([
      {
        localId: `${Date.now()}-manual`,
        description: '',
        confidence: 1,
        regulation_reference: '',
        severity: 'moderate',
        estimated_cost_min: null,
        estimated_cost_max: null,
        box: DEFAULT_POLYGON,
        included: true,
        isManual: true,
      },
    ])
  }

  function updateFinding(localId: string, patch: Partial<Finding>) {
    setFindings((prev) => prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)))
  }

  async function handleSaveFindings() {
    const included = findings.filter((f) => f.included)
    if (!file || !inspectionId || included.length === 0) {
      setError('No findings selected to save.')
      return
    }
    if (included.some((f) => !f.description.trim())) {
      setError('Add a description before saving.')
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

    const filePath = `${assetId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('fmiq-inspection-photos').upload(filePath, file)
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setSaving(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('fmiq-inspection-photos').getPublicUrl(filePath)

    const rows = included.map((f) => ({
      inspection_id: inspectionId,
      asset_id: assetId,
      company_name: profile?.company_name,
      photo_url: publicUrl,
      bounding_box: f.box,
      description: f.description,
      ai_description: f.isManual ? null : f.description,
      regulation_reference: f.regulation_reference || null,
      severity: f.severity,
      estimated_cost_min: f.estimated_cost_min,
      estimated_cost_max: f.estimated_cost_max,
    }))

    const { error: insertError } = await supabase.from('fmiq_inspection_findings').insert(rows)
    if (insertError) {
      setError(`Could not save findings: ${insertError.message}`)
      setSaving(false)
      return
    }

    setSavedCount((prev) => prev + included.length)
    setFile(null)
    setPreview(null)
    setFindings([])
    setOrientationHint(null)
    setSaving(false)
  }

  async function handleComplete() {
    if (!inspectionId) return
    setCompleting(true)
    await supabase
      .from('fmiq_inspections')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', inspectionId)
    router.push(`/fmiq/inspections/${inspectionId}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
      <div className="mx-auto max-w-md">
        <PageHeader title="New Inspection" />

        {!inspectionId ? (
          <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            {assets.length === 0 ? (
              <p className="text-sm text-deck-dim">No properties yet - add one first.</p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-deck-body">Property</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleStart}
              disabled={starting || assets.length === 0}
              className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start inspection'}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            {savedCount > 0 && (
              <p className="text-xs text-emerald-700">{savedCount} finding{savedCount === 1 ? '' : 's'} saved so far.</p>
            )}

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
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            {preview && (
              <div className="relative w-full">
                <img src={preview} alt="Preview" className="w-full rounded-md" />
                {findings.map((f, i) =>
                  Array.isArray(f.box) ? (
                    <PolygonBoxEditor
                      key={f.localId}
                      points={f.box}
                      onChange={(points) => updateFinding(f.localId, { box: points })}
                    />
                  ) : (
                    <div
                      key={f.localId}
                      style={{
                        position: 'absolute',
                        left: `${f.box.x}%`,
                        top: `${f.box.y}%`,
                        width: `${f.box.width}%`,
                        height: `${f.box.height}%`,
                        border: `2px solid ${BOX_COLORS[i % BOX_COLORS.length]}`,
                        opacity: f.included ? 1 : 0.3,
                      }}
                    >
                      <span
                        style={{ backgroundColor: BOX_COLORS[i % BOX_COLORS.length] }}
                        className="absolute -top-5 left-0 rounded px-1 text-[10px] font-semibold text-white"
                      >
                        {i + 1}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            {file && findings.length === 0 && !analyzing && (
              <div className="flex gap-2">
                <button
                  onClick={handleAnalyze}
                  className="flex-1 rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg"
                >
                  Analyze with AI
                </button>
                <button
                  onClick={handleAddManual}
                  className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
                >
                  Add without analysis
                </button>
              </div>
            )}

            {analyzing && <p className="text-sm text-deck-dim">Analyzing photo...</p>}

            {findings.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-deck-body">
                  {findings[0]?.isManual
                    ? 'Drag the outline onto the issue, then describe it below'
                    : `${findings.length} issue${findings.length > 1 ? 's' : ''} found - review below`}
                </p>
                {findings.map((f, i) => (
                  <div
                    key={f.localId}
                    className="rounded-lg border border-deck-border p-3"
                    style={{ borderLeftWidth: 4, borderLeftColor: BOX_COLORS[i % BOX_COLORS.length] }}
                  >
                    <div className="flex items-center justify-between">
                      <select
                        value={f.severity}
                        onChange={(e) => updateFinding(f.localId, { severity: e.target.value as Finding['severity'] })}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[f.severity]}`}
                      >
                        {SEVERITY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-deck-body">
                        <input
                          type="checkbox"
                          checked={f.included}
                          onChange={(e) => updateFinding(f.localId, { included: e.target.checked })}
                        />
                        Include
                      </label>
                    </div>
                    <textarea
                      value={f.description}
                      onChange={(e) => updateFinding(f.localId, { description: e.target.value })}
                      rows={2}
                      placeholder={f.isManual ? 'Describe what you found' : undefined}
                      className="mt-2 w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    {f.regulation_reference && (
                      <p className="mt-1 text-xs text-deck-dim">Ref: {f.regulation_reference}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        value={f.estimated_cost_min ?? ''}
                        onChange={(e) =>
                          updateFinding(f.localId, { estimated_cost_min: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="Min cost"
                        className="w-1/2 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                      />
                      <input
                        type="number"
                        value={f.estimated_cost_max ?? ''}
                        onChange={(e) =>
                          updateFinding(f.localId, { estimated_cost_max: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="Max cost"
                        className="w-1/2 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSaveFindings}
                  disabled={saving || findings.filter((f) => f.included).length === 0}
                  className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save findings & add another photo'}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text disabled:opacity-50"
            >
              {completing ? 'Finishing...' : 'Complete inspection'}
            </button>
          </div>
        )}
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
