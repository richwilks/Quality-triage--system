'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

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
              {d.image_url && (
                <img src={d.image_url} alt={d.name || 'Drawing'} className="h-28 w-full object-cover" />
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Level 2 Floor Plan"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 w-full text-sm"
          />
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
