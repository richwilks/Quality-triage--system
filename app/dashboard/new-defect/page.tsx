'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string }
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
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadProjects() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('project_members')
        .select('projects(id, name)')
        .eq('user_id', user.id)

      const list: Project[] = (data || []).flatMap((row: any) =>
        Array.isArray(row.projects)
          ? row.projects
          : row.projects
          ? [row.projects]
          : []
      )

      setProjects(list)
      if (list.length > 0) setProjectId(list[0].id)
    }
    loadProjects()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setAnalysis(null)
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

      const result = await res.json()
      setAnalysis(result)
    } catch (err) {
      setError('Something went wrong analyzing the photo. Try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSaveDraft() {
    if (!file || !analysis || !projectId) return
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
        photo_url: publicUrl,
        ai_description: analysis.description,
        ai_confidence: analysis.confidence,
        standard_reference: analysis.standard_reference,
        description: analysis.description,
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
          Take or upload a photo to check it against the project spec.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Project
          </label>
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

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Photo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-1 w-full text-sm"
          />


          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              className="mt-4 max-h-64 w-full rounded-md object-cover"
            />
          )}

          {file && !analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !projectId}
              className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze photo'}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {analysis && !saved && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                {analysis.defect_found
                  ? 'Potential defect identified'
                  : 'No defect identified'}
              </p>
              <p className="mt-1 text-sm text-slate-600">{analysis.description}</p>
              {analysis.standard_reference && (
                <p className="mt-1 text-xs text-slate-500">
                  Standard: {analysis.standard_reference}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Confidence: {Math.round(analysis.confidence * 100)}%
              </p>

              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm & save as draft'}
              </button>
            </div>
          )}

          {saved && (
            <p className="mt-4 text-sm font-medium text-green-600">
              Saved as a draft defect. You can review it on the dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
