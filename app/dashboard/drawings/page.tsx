'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'

type Project = { id: string; name: string }
type Drawing = { id: string; name: string | null; image_url: string | null }

function DrawingsPageInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(searchParams.get('projectId') || '')
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [blankName, setBlankName] = useState('')
  const [creatingBlank, setCreatingBlank] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (projectId) loadDrawings()
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
    if (!projectId && list.length > 0) setProjectId(list[0].id)
    setLoading(false)
  }

  async function loadDrawings() {
    const { data } = await supabase
      .from('drawings')
      .select('id, name, image_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setDrawings(data || [])
  }

  async function handleUpload() {
    if (!file || !projectId) return
    setUploading(true)

    const path = `${projectId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('project-drawings')
      .upload(path, file)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('project-drawings')
        .getPublicUrl(path)

      await supabase.from('drawings').insert({
        project_id: projectId,
        name: name || file.name,
        image_url: publicUrl,
      })

      setName('')
      setFile(null)
      loadDrawings()
    }
    setUploading(false)
  }

  async function handleCreateBlank() {
    if (!blankName.trim() || !projectId) return
    setCreatingBlank(true)

    await supabase.from('drawings').insert({
      project_id: projectId,
      name: blankName.trim(),
      image_url: null,
    })

    setBlankName('')
    loadDrawings()
    setCreatingBlank(false)
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
        <PageHeader title="Drawings" />
        <p className="mt-1 text-sm text-deck-dim">
          Choose a drawing, then tap it to drop a pin and raise a defect at that location.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
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

        <div className="mt-4 grid grid-cols-2 gap-3">
          {drawings.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/drawings/${d.id}`}
              className="overflow-hidden rounded-lg border border-deck-border bg-deck-surface"
            >
              {d.image_url ? (
                <img src={d.image_url} alt={d.name || 'Drawing'} className="h-28 w-full object-cover" />
              ) : (
                <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-deck-raised text-deck-mute">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeWidth="1" opacity="0.6" />
                  </svg>
                  <span className="text-[10px] font-medium uppercase tracking-wide">Blank plan</span>
                </div>
              )}
              <p className="p-2 text-xs font-medium text-deck-body truncate">{d.name}</p>
            </Link>
          ))}
        </div>

        {drawings.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">No drawings uploaded for this project yet.</p>
        )}

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Upload a new drawing</p>
          <input spellCheck="true"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Level 2 Floor Plan"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <FileDropZone
            onFiles={(files) => setFile(files[0])}
            accept="image/*"
            className="mt-2 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
          >
            {file ? file.name : 'Choose a drawing, or drag and drop it here'}
          </FileDropZone>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !projectId}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload drawing'}
          </button>
          <p className="mt-2 text-xs text-deck-dim">
            Photos or scanned plans work best as JPG/PNG. PDF plans need converting to an image first for now.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">No drawing for this area yet?</p>
          <p className="mt-1 text-xs text-deck-dim">
            Start a blank plan and build it on site - sketch each room's outline by tapping its corners, then record
            the actual measured wall lengths with "Record as-built dimension." No photo or drawing needed.
          </p>
          <input spellCheck="true"
            type="text"
            value={blankName}
            onChange={(e) => setBlankName(e.target.value)}
            placeholder="e.g. Ground Floor - measured on site"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <button
            onClick={handleCreateBlank}
            disabled={creatingBlank || !blankName.trim() || !projectId}
            className="mt-3 w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
          >
            {creatingBlank ? 'Creating...' : 'Start a blank plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DrawingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <DrawingsPageInner />
    </Suspense>
  )
}
