'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string; spec_document_url: string | null; spec_extracted_text: string | null }

export default function ProjectSpecPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('project_members')
      .select('projects(id, name, spec_document_url, spec_extracted_text)')
      .eq('user_id', user.id)

    const list = (data || []).flatMap((row: any) =>
      Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
    )
    setProjects(list)
    if (list.length > 0) setProjectId(list[0].id)
    setLoading(false)
  }

  const currentProject = projects.find((p) => p.id === projectId)

  async function handleUpload() {
    if (!file || !projectId) return
    setUploading(true)

    const path = `${projectId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('project-specs').upload(path, file)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('project-specs').getPublicUrl(path)

      await supabase
        .from('projects')
        .update({ spec_document_url: publicUrl, spec_extracted_text: null })
        .eq('id', projectId)

      setFile(null)
      setUploading(false)
      setExtracting(true)

      await fetch('/api/extract-spec-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      setExtracting(false)
      load()
    } else {
      setUploading(false)
    }
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
        <h1 className="text-xl font-semibold text-slate-900">Project Specification</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload the spec document for a project. It's processed once, then reused for every photo analysis.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

          {currentProject?.spec_document_url ? (
            <p className="mt-3 text-sm text-green-700">
              A specification is attached.{' '}
              <a href={currentProject.spec_document_url} target="_blank" rel="noreferrer" className="underline">
                View it
              </a>
              {currentProject.spec_extracted_text ? (
                <span className="ml-1 text-slate-500">- ready for analysis.</span>
              ) : (
                <span className="ml-1 text-amber-600">- still processing, try again shortly.</span>
              )}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No specification uploaded yet for this project.</p>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700">
            {currentProject?.spec_document_url ? 'Replace with a new PDF' : 'Upload spec PDF'}
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 w-full text-sm"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || extracting || !file || !projectId}
            className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : extracting ? 'Processing document...' : 'Save specification'}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Processing happens once per upload, so future photo analysis stays fast.
          </p>
        </div>
      </div>
    </div>
  )
}
