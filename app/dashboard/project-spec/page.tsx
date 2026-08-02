'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string }
type ProjectSpec = { id: string; name: string | null; document_url: string | null; extracted_text: string | null }

export default function ProjectSpecPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [specs, setSpecs] = useState<ProjectSpec[]>([])
  const [specName, setSpecName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (projectId) loadSpecs()
  }, [projectId])

  async function loadProjects() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('project_members')
      .select('projects(id, name)')
      .eq('user_id', user.id)

    const list = (data || []).flatMap((row: any) =>
      Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
    )
    setProjects(list)
    if (list.length > 0) setProjectId(list[0].id)
    setLoading(false)
  }

  async function loadSpecs() {
    const { data } = await supabase
      .from('project_specs')
      .select('id, name, document_url, extracted_text')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setSpecs(data || [])
  }

  async function handleUpload() {
    if (!file || !projectId) return
    setUploading(true)
    setError(null)

    const path = `${projectId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('project-specs').upload(path, file)

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('project-specs').getPublicUrl(path)

    const { data: inserted, error: insertError } = await supabase
      .from('project_specs')
      .insert({
        project_id: projectId,
        name: specName || file.name,
        document_url: publicUrl,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      setError(`Could not save spec: ${insertError?.message || 'unknown error'}`)
      setUploading(false)
      return
    }

    setFile(null)
    setSpecName('')
    setUploading(false)
    setExtracting(true)

    try {
      const res = await fetch('/api/extract-spec-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId: inserted.id }),
      })
      if (!res.ok) {
        let detail = `status ${res.status}`
        try {
          const body = await res.json()
          detail = body.error || detail
        } catch {}
        setError(`Uploaded, but text extraction failed: ${detail}.`)
      }
    } catch (err: any) {
      setError(`Uploaded, but text extraction failed: ${err?.message || 'network error'}.`)
    } finally {
      setExtracting(false)
      loadSpecs()
    }
  }

  async function handleRetry(specId: string) {
    setError(null)
    setExtracting(true)
    try {
      const res = await fetch('/api/extract-spec-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId }),
      })
      if (!res.ok) {
        let detail = `status ${res.status}`
        try {
          const body = await res.json()
          detail = body.error || detail
        } catch {}
        setError(`Retry failed: ${detail}.`)
      }
    } catch (err: any) {
      setError(`Retry failed: ${err?.message || 'network error'}.`)
    } finally {
      setExtracting(false)
      loadSpecs()
    }
  }

  async function handleDelete(specId: string) {
    await supabase.from('project_specs').delete().eq('id', specId)
    loadSpecs()
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
        <PageHeader title="Project Specifications" />
        <p className="mt-1 text-sm text-slate-500">
          Upload as many spec documents as needed - each is processed once, then reused for every photo analysis on this project.
        </p>

        <div className="mt-4">
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

        <div className="mt-4 space-y-2">
          {specs.length === 0 && (
            <p className="text-sm text-slate-500">No specifications uploaded yet for this project.</p>
          )}
          {specs.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  {s.document_url && (
                    <a href={s.document_url} target="_blank" rel="noreferrer" className="text-xs text-brand-primary underline">
                      View document
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs font-medium text-red-600"
                >
                  Remove
                </button>
              </div>
              <p className="mt-1 text-xs">
                {s.extracted_text ? (
                  <span className="text-green-700">Ready for analysis</span>
                ) : (
                  <span className="text-amber-600">
                    Processing...{' '}
                    <button
                      onClick={() => handleRetry(s.id)}
                      disabled={extracting}
                      className="ml-1 underline text-brand-primary disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Add a specification</p>
          <input
            type="text"
            value={specName}
            onChange={(e) => setSpecName(e.target.value)}
            placeholder="e.g. Architectural Spec, M&E Spec"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 w-full text-sm"
          />

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading || extracting || !file || !projectId}
            className="mt-3 w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : extracting ? 'Processing document...' : 'Add specification'}
          </button>
        </div>
      </div>
    </div>
  )
}
