'use client'

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
  ncr_number: string | null
  element_type: string | null
  classification: string | null
  created_at: string
}

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'pending_approval', 'closed', 'rejected']

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  floor: 'Floor',
  wall: 'Wall',
  ceiling: 'Ceiling',
  structural_steel: 'Structural steel',
  cladding_envelope: 'Cladding / envelope',
  fire_penetration: 'Fire penetration / seal',
  movement_joint: 'Movement joint',
  mep: 'MEP',
  other: 'Other',
}

type SortKey = 'date_desc' | 'date_asc' | 'type' | 'category'

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  type: 'Type',
  category: 'Category (Snag / NCR)',
}

export default function ProjectDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('date_desc')

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
      .select('id, title, status, target_close_date, ncr_number, element_type, classification, created_at')
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

  const sortedDefects = [...defects].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'type':
        return (ELEMENT_TYPE_LABELS[a.element_type || ''] || a.element_type || '').localeCompare(
          ELEMENT_TYPE_LABELS[b.element_type || ''] || b.element_type || ''
        )
      case 'category':
        return (a.classification || '').localeCompare(b.classification || '')
      case 'date_desc':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-start justify-between">
          <PageHeader title={project.name} />
          {isOwner && (
            <div className="flex flex-col items-end gap-1">
              <Link
                href={`/dashboard/projects/${projectId}/edit`}
                className="whitespace-nowrap text-xs font-medium text-deck-text underline"
              >
                Edit project
              </Link>
              <Link
                href={`/dashboard/projects/${projectId}/team`}
                className="whitespace-nowrap text-xs font-medium text-deck-text underline"
              >
                Manage team
              </Link>
            </div>
          )}
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-deck-dim">{project.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <StatusBadge status={s} />
              <span className="text-xs font-medium text-deck-body">{counts[s]}</span>
            </div>
          ))}
          {defects.length === 0 && (
            <p className="text-sm text-deck-dim">No defects logged yet.</p>
          )}
        </div>

                <div className="mt-6 flex gap-3">
          <Link
            href={`/dashboard/new-defect?projectId=${projectId}`}
            className="inline-block rounded-md bg-deck-accent px-4 py-2 text-sm font-medium text-deck-bg"
          >
            + New defect
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/report`}
            className="inline-block rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body"
          >
            View report
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/reg38`}
            className="inline-block rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body"
          >
            Regulation 38 / Golden Thread
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/inspect`}
            className="inline-block rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body"
          >
            Inspection path
          </Link>
        </div>


        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">
            All defects
          </h2>
          {defects.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
              aria-label="Sort defects"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  Sort: {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {sortedDefects.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/defects/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <div>
                {d.ncr_number && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-deck-mute">
                    {d.ncr_number}
                  </p>
                )}
                <p className="text-sm font-medium text-deck-text">{d.title || 'Untitled'}</p>
                <p className="mt-0.5 text-xs text-deck-dim">
                  {[
                    d.element_type ? ELEMENT_TYPE_LABELS[d.element_type] || d.element_type : null,
                    d.classification ? d.classification.toUpperCase() : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {d.target_close_date && (
                  <p className="mt-1 text-xs text-deck-dim">Due {d.target_close_date}</p>
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
