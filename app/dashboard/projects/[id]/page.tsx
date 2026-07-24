l'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string; description: string | null }
type Defect = {
  id: string
  title: string | null
  status: string
  target_close_date: string | null
}

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']

export default function ProjectDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, description')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    const { data: defectData } = await supabase
      .from('defects')
      .select('id, title, status, target_close_date')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setDefects(defectData || [])

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: membership } = await supabase
        .from('project_members')
        .select('project_role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsOwner(membership?.project_role === 'owner')
    }

    setLoading(false)
  }

  const counts: Record<string, number> = {}
  defects.forEach((d) => {
    counts[d.status] = (counts[d.status] || 0) + 1
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-start justify-between">
          <PageHeader title={project.name} />
          {isOwner && (
            <div className="flex flex-col items-end gap-1">
              <Link
                href={`/dashboard/projects/${projectId}/edit`}
                className="whitespace-nowrap text-xs font-medium text-slate-900 underline"
              >
                Edit project
              </Link>
              <Link
                href={`/dashboard/projects/${projectId}/team`}
                className="whitespace-nowrap text-xs font-medium text-slate-900 underline"
              >
                Manage team
              </Link>
            </div>
          )}
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-slate-500">{project.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <StatusBadge status={s} />
              <span className="text-xs font-medium text-slate-600">{counts[s]}</span>
            </div>
          ))}
          {defects.length === 0 && (
            <p className="text-sm text-slate-500">No defects logged yet.</p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/dashboard/new-defect?projectId=${projectId}`}
            className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            + New defect
          </Link>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          All defects
        </h2>

        <div className="mt-3 space-y-2">
          {defects.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/defects/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{d.title || 'Untitled'}</p>
                {d.target_close_date && (
                  <p className="text-xs text-slate-400">Due {d.target_close_date}</p>
                )}
              </div>
              <StatusBadge status={d.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
