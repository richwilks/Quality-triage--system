'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/import PageHeader from '@/components/PageHeader'
import PageHeader from '@/components/PageHeader'


type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

type Frame = { time: number; dataUrl: string; blob: Blob }

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
  frameIndex: number
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
const FRAME_COUNT = 6

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler)
      resolve()
    }
    video.addEventListener('seeked', handler)
    video.currentTime = time
  })
}

function extractFrames(file: File, frameCount: number): Promise<Frame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('No canvas context')

        const frames: Frame[] = []
        for (let i = 0; i < frameCount; i++) {
          const t = (duration / (frameCount + 1)) * (i + 1)
          await seekTo(video, t)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const blob: Blob = await new Promise((res) =>
            canvas.toBlob((b) => res(b as Blob), 'image/jpeg', 0.85)
          )
          frames.push({ time: t, dataUrl, blob })
        }
        resolve(frames)
      } catch (err) {
        reject(err)
      }
    }
    video.onerror = () => reject(new Error('Could not read video'))
  })
}

export default function NewDefectVideoPage() {
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedPartnerId, setAssignedPartnerId] = useState('')
  const [location, setLocation] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [frames, setFrames] = useState<Frame[]>([])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [framesDone, setFramesDone] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  async function loadDataOnce() {
    if (projects.length > 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: projectData } = await supabase
      .from('project_members')
      .select('projects(id, name)')
      .eq('user_id', user.id)

    const projectList = (projectData || []).flatMap((row: any) =>
      Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
    )
    setProjects(projectList)
    if (projectList.length > 0) setProjectId(projectList[0].id)

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('role', 'partner')
    setPartners(partnerData || [])
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    await loadDataOnce()
    setVideoFile(selected)
    setFrames([])
    setItems([])
    setSaved(false)
    setError(null)
    setFramesDone(0)
  }

  function base64FromDataUrl(dataUrl: string) {
    return dataUrl.split(',')[1]
  }

  async function handleAnalyze() {
    if (!videoFile || !projectId) return
    setProcessing(true)
    setError(null)
    setFramesDone(0)

    try {
      setProgress('Reading video...')
      const extracted = await extractFrames(videoFile, FRAME_COUNT)
      setFrames(extracted)

      const allItems: ReviewItem[] = []
      let frameErrors = 0
      let lastErrorMessage = ''

      for (let i = 0; i < extracted.length; i++) {
        setProgress(`Analyzing frame ${i + 1} of ${extracted.length}...`)
        const base64 = base64FromDataUrl(extracted[i].dataUrl)

        try {
          const res = await fetch('/api/analyze-defect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', projectId }),
          })

          if (!res.ok) {
            frameErrors++
            try {
              const errBody = await res.json()
              lastErrorMessage = errBody.error || `status ${res.status}`
            } catch {
              lastErrorMessage = `status ${res.status}`
            }
          } else {
            const result: { defects: DetectedDefect[] } = await res.json()
            result.defects?.forEach((d, j) => {
              allItems.push({
                ...d,
                localId: `${i}-${j}`,
                title: `Defect ${allItems.length + 1}`,
                included: true,
                frameIndex: i,
              })
            })
          }
        } catch (frameErr: any) {
          frameErrors++
          lastErrorMessage = frameErr?.message || 'connection lost'
        }

        setFramesDone(i + 1)
        setItems([...allItems])
      }

      if (frameErrors === extracted.length) {
        setError(`All ${extracted.length} frames failed to analyze. Last error: ${lastErrorMessage}. This often happens if the app is backgrounded or the connection drops mid-way - try again keeping this tab in the foreground on wifi.`)
      } else if (allItems.length === 0) {
        setError(
          frameErrors > 0
            ? `No defects found, though ${frameErrors} of ${extracted.length} frames failed. Last error: ${lastErrorMessage}`
            : 'No defects were spotted across the video frames checked.'
        )
      } else if (frameErrors > 0) {
        setError(`${frameErrors} of ${extracted.length} frames failed to analyze, but results below are from the rest.`)
      }
    } catch (err: any) {
      setError(`Unexpected error reading the video: ${err?.message || 'unknown'}. If you switched apps while this was running, try again and keep this tab open in the foreground.`)
    } finally {
      setProcessing(false)
      setProgress('')
    }
  }

  function updateItem(localId: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)))
  }

  async function handleSave() {
    const included = items.filter((it) => it.included)
    if (!videoFile || !projectId || included.length === 0) {
      setError('Select at least one defect to save.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const videoPath = `${projectId}/${Date.now()}-${videoFile.name}`
      const { error: videoUploadError } = await supabase.storage
        .from('defect-videos')
        .upload(videoPath, videoFile)
      if (videoUploadError) {
        setError(`Video upload failed: ${videoUploadError.message}`)
        setSaving(false)
        return
      }

      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('defect-videos')
        .getPublicUrl(videoPath)

      const rows = []
      for (const it of included) {
        const frame = frames[it.frameIndex]
        const framePath = `${projectId}/${Date.now()}-frame-${it.localId}.jpg`
        const { error: frameUploadError } = await supabase.storage
          .from('defect-photos')
          .upload(framePath, frame.blob)
        if (frameUploadError) {
          setError(`Frame upload failed: ${frameUploadError.message}`)
          setSaving(false)
          return
        }

        const { data: { publicUrl: photoUrl } } = supabase.storage
          .from('defect-photos')
          .getPublicUrl(framePath)

        rows.push({
          project_id: projectId,
          title: it.title,
          location,
          photo_url: photoUrl,
          video_url: videoUrl,
          ai_description: it.description,
          ai_confidence: it.confidence,
          standard_reference: it.standard_reference,
          description: it.description,
          bounding_box: it.box,
          assigned_partner_id: assignedPartnerId || null,
          target_close_date: targetDate || null,
          status: 'draft',
          created_by: user.id,
        })
      }

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

  const itemsByFrame = frames.map((_, i) => items.filter((it) => it.frameIndex === i))
  const progressPercent = frames.length > 0 ? Math.round((framesDone / frames.length) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
         <PageHeader title="New Defec. Video" />
        <p className="mt-1 text-sm text-slate-500">
          Upload a walkthrough video - {FRAME_COUNT} frames will be sampled and checked for defects.
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
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Block A, Level 2"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Video</label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="mt-1 w-full text-sm"
            />
          </div>

          {videoFile && frames.length === 0 && !processing && (
            <button
              onClick={handleAnalyze}
              disabled={!projectId}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Analyze video
            </button>
          )}

          {processing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">{progress || 'Working...'}</p>
              {frames.length > 0 && (
                <>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 bg-slate-900 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {framesDone} of {frames.length} frames checked - keep this tab open and in the foreground
                  </p>
                </>
              )}
            </div>
          )}

          {frames.map((frame, i) => (
            <div key={i}>
              <div className="relative w-full">
                <img src={frame.dataUrl} alt={`Frame ${i + 1}`} className="w-full rounded-md" />
                {itemsByFrame[i].map((it) => {
                  const colorIndex = items.findIndex((x) => x.localId === it.localId)
                  return (
                    <div
                      key={it.localId}
                      style={{
                        position: 'absolute',
                        left: `${it.box.x}%`,
                        top: `${it.box.y}%`,
                        width: `${it.box.width}%`,
                        height: `${it.box.height}%`,
                        border: `2px solid ${BOX_COLORS[colorIndex % BOX_COLORS.length]}`,
                        opacity: it.included ? 1 : 0.3,
                      }}
                    >
                      <span
                        style={{ backgroundColor: BOX_COLORS[colorIndex % BOX_COLORS.length] }}
                        className="absolute -top-5 left-0 rounded px-1 text-[10px] font-semibold text-white"
                      >
                        {colorIndex + 1}
                      </span>
                    </div>
                  )
                })}
              </div>

              {itemsByFrame[i].length > 0 && (
                <div className="mt-2 space-y-3">
                  {itemsByFrame[i].map((it) => {
                    const colorIndex = items.findIndex((x) => x.localId === it.localId)
                    return (
                      <div
                        key={it.localId}
                        className="rounded-lg border border-slate-200 p-3"
                        style={{ borderLeftWidth: 4, borderLeftColor: BOX_COLORS[colorIndex % BOX_COLORS.length] }}
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
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {items.length > 0 && !processing && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Assigned</label>
                <select
                  value={assignedPartnerId}
                  onChange={(e) => setAssignedPartnerId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name || p.full_name || 'Partner'}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700">Date created</label>
                  <p className="mt-1 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">{todayLabel}</p>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700">Target completion</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {items.length > 0 && !saved && !processing && (
            <button
              onClick={handleSave}
              disabled={saving || items.filter((i) => i.included).length === 0}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save selected defects'}
            </button>
          )}
          {saved && (
            <p className="text-sm font-medium text-green-600">
              Saved. You can review them on the dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
