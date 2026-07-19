'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }
type Analysis = {
  defect_found: boolean
  description: string
  confidence: number
  standard_reference: string
}

export default function NewDefectPage() {
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedPartnerId, setAssignedPartnerId] = useState('')

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [description, setDescription] = useState('')
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
      if (projectList.length > 0) setProjectId(projectList[0].id)

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
    setAnalysis(null)
    setDescription('')
    setSaved(false)
    setPreview(URL.createObjectURL(selected))
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function handleAnalyze() {
    if (!file || !projectId) return
    setAnalyzing(true)
    setError(null)

    try {
      const base64 = await fileToBase64(file)

      const res = await fetch('/api/analyze-defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          projectId,
        }),
      })

      if (!res.ok) throw new Error('Analysis failed')

      const result: Analysis = await res.json()
      setAnalysis(result)
      setDescription(result.description)
    } catch (err) {
      setError('Something went wrong analyzing the photo. Try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!file || !projectId || !title) {
      setError('Please add a title and photo before saving.')
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

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('defect-photos').getPublicUrl(filePath)

      const { error: insertError } = await supabase.from('defects').insert({
        project_id: projectId,
        title,
        location,
        photo_url: publicUrl,
        ai_description: analysis?.description || null,
        ai_confidence: analysis?.confidence ?? null,
        standard_reference: analysis?.standard_reference || null,
        description,
        assigned_partner_id: assignedPartnerId || null,
        target_close_date: targetDate || null,
        status: 'draft',
        created_by: user.id,
      })

      if (insertError) throw insertError

      setSaved(true)
    } catch (err) {
      setError('Could not save the defect. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">New Defect</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the details and analyze a photo against the project spec.
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
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cracked render, east elevation"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Block A, Level 2, Room 214"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
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
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 w-full rounded-md object-cover"
            />
          )}

          {file && !analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !projectId}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze photo'}
            </button>
          )}

          {analysis && (
            <p className="text-xs text-slate-500">
              AI confidence: {Math.round(analysis.confidence * 100)}%
              {analysis.standard_reference && ` · Standard: ${analysis.standard_reference}`}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Analyze a photo to auto-fill, or type your own"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

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
              disabled={saving || !file || !title}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save defect'}
            </button>
          ) : (
            <p className="text-sm font-medium text-green-600">
              Saved as a draft defect. You can review it on the dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
