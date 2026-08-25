'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'

type Project = { id: string; name: string }
type ProjectSpec = { id: string; name: string | null; document_url: string | null; extracted_text: string | null }
type UploadProgress = { fileName: string; status: 'uploading' | 'processing' | 'done' | 'error'; error?: string }

export default function ProjectSpecPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [specs, setSpecs] = useState<ProjectSpec[]>([])
  const [specName, setSpecName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<UploadProgress[]>([])

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (projectId) loadSpecs()
  }, [projectId])

  async function loadProjects() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    let list: Project[]
    if (profile?.is_platform_admin) {
      const { data: allProjects } = await supabase.from('projects').select('id, name')
      list = allProjects || []
    } else {
      const { data } = await supabase
        .from('project_members')
        .select('projects(id, name)')
        .eq('user_id', user.id)

      list = (data || []).flatMap((row: any) =>
        Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
      )
    }
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
    if (files.length === 0 || !projectId) return
    setUploading(true)
    setError(null)
    setProgress(files.map((f) => ({ fileName: f.name, status: 'uploading' })))

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const nameForThisFile = files.length === 1 && specName ? specName : file.name

      try {
        const path = `${projectId}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('project-specs').upload(path, file)

        if (uploadError) {
          setProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: uploadError.message } : p))
          )
          continue
        }

        const { data: { publicUrl } } = supabase.storage.from('project-specs').getPublicUrl(path)

        const { data: inserted, error: insertError } = await supabase
          .from('project_specs')
          .insert({
            project_id: projectId,
            name: nameForThisFile,
            document_url: publicUrl,
          })
          .select()
          .single()

        if (insertError || !inserted) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error', error: insertError?.message || 'unknown error' } : p
            )
          )
          continue
        }

        setProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'processing' } : p)))

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
            setProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: detail } : p))
            )
          } else {
            setProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'done' } : p)))
          }
        } catch (err: any) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error', error: err?.message || 'network error' } : p
            )
          )
        }
      } catch (err: any) {
        setProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: err?.message || 'unexpected error' } : p))
        )
      }
    }

    setFiles([])
    setSpecName('')
    setUploading(false)
    loadSpecs()
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

  function handleFileSelect(selected: File[]) {
    setFiles(selected)
  }

  function removeSelectedFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  const anyInProgress = uploading

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Project Specifications" />
        <p className="mt-1 text-sm text-deck-dim">
          Upload as many spec documents as needed - each is processed once, then reused for every photo analysis on this project.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-deck-body">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {specs.length === 0 && (
            <p className="text-sm text-deck-dim">No specifications uploaded yet for this project.</p>
          )}
          {specs.map((s) => (
            <div key={s.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-deck-text">{s.name}</p>
                  {s.document_url && (
                    <a href={s.document_url} target="_blank" rel="noreferrer" className="text-xs text-deck-accent underline">
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
                  <span className="text-emerald-700">Ready for analysis</span>
                ) : (
                  <span className="text-amber-700">
                    Processing...{' '}
                    <button
                      onClick={() => handleRetry(s.id)}
                      disabled={extracting}
                      className="ml-1 underline text-deck-accent disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Add specification(s)</p>
          <input
            type="text"
            value={specName}
            onChange={(e) => setSpecName(e.target.value)}
            placeholder="Name (only used if selecting a single file)"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <FileDropZone
            onFiles={handleFileSelect}
            accept="application/pdf"
            multiple
            className="mt-2 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
          >
            {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Choose PDF(s), or drag and drop them here'}
          </FileDropZone>

          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-deck-raised px-2 py-1 text-xs text-deck-body">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => removeSelectedFile(i)} className="ml-2 text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}

          {progress.length > 0 && (
            <div className="mt-3 space-y-1">
              {progress.map((p, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-deck-body">{p.fileName}</span>{' '}
                  {p.status === 'uploading' && <span className="text-deck-dim">Uploading...</span>}
                  {p.status === 'processing' && <span className="text-amber-700">Processing...</span>}
                  {p.status === 'done' && <span className="text-emerald-700">Ready</span>}
                  {p.status === 'error' && <span className="text-red-600">Failed: {p.error}</span>}
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={anyInProgress || files.length === 0 || !projectId}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {uploading ? `Processing ${files.length} file(s)...` : `Add ${files.length || ''} specification${files.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
