'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string; description: string | null }
type Defect = {
  id: string
  title: string | null
  description: string | null
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

type SortColumn = 'ref' | 'title' | 'type' | 'category' | 'status' | 'due'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'ref', label: 'Ref' },
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'due', label: 'Due' },
]

export default function ProjectDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('due')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
      .select('id, title, description, status, target_close_date, ncr_number, element_type, classification, created_at')
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

  const filteredDefects = defects.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (categoryFilter !== 'all' && d.classification !== categoryFilter) return false
    if (typeFilter !== 'all' && d.element_type !== typeFilter) return false
    return true
  })

  function compareBy(column: SortColumn, a: Defect, b: Defect) {
    switch (column) {
      case 'ref':
        return (a.ncr_number || '').localeCompare(b.ncr_number || '')
      case 'title':
        return (a.title || '').localeCompare(b.title || '')
      case 'type':
        return (ELEMENT_TYPE_LABELS[a.element_type || ''] || a.element_type || '').localeCompare(
          ELEMENT_TYPE_LABELS[b.element_type || ''] || b.element_type || ''
        )
      case 'category':
        return (a.classification || '').localeCompare(b.classification || '')
      case 'status':
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      case 'due':
      default:
        if (!a.target_close_date && !b.target_close_date) return 0
        if (!a.target_close_date) return 1
        if (!b.target_close_date) return -1
        return a.target_close_date.localeCompare(b.target_close_date)
    }
  }

  const sortedDefects = [...filteredDefects].sort((a, b) => {
    const cmp = compareBy(sortColumn, a, b)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDir('asc')
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === sortedDefects.length ? new Set() : new Set(sortedDefects.map((d) => d.id))
    )
  }

  const usedElementTypes = Array.from(new Set(defects.map((d) => d.element_type).filter(Boolean))) as string[]

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
          {selected.size > 0 && (
            <button
              onClick={() =>
                router.push(`/dashboard/projects/${projectId}/report?ids=${Array.from(selected).join(',')}`)
              }
              className="rounded-md bg-deck-accent px-3 py-1.5 text-xs font-medium text-deck-bg"
            >
              Create report from {selected.size} selected
            </button>
          )}
        </div>

        {defects.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
              aria-label="Filter by category"
            >
              <option value="all">Snag &amp; NCR</option>
              <option value="snag">Snag only</option>
              <option value="ncr">NCR only</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {usedElementTypes.map((t) => (
                <option key={t} value={t}>
                  {ELEMENT_TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 overflow-x-auto rounded-lg border border-deck-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-deck-border bg-deck-raised text-xs text-deck-dim">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={sortedDefects.length > 0 && selected.size === sortedDefects.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all defects"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer select-none px-3 py-2 font-medium hover:text-deck-text"
                  >
                    {col.label}
                    {sortColumn === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {sortedDefects.map((d) => (
                <tr key={d.id} className="border-b border-deck-border last:border-b-0 hover:bg-deck-raised">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggleSelected(d.id)}
                      aria-label={`Select ${d.title || 'defect'}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-deck-mute">{d.ncr_number || '-'}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/defects/${d.id}`} className="font-medium text-deck-text hover:underline">
                      {d.title || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-deck-dim">
                    {d.element_type ? ELEMENT_TYPE_LABELS[d.element_type] || d.element_type : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-deck-dim">
                    {d.classification ? d.classification.toUpperCase() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-deck-dim">{d.target_close_date || '-'}</td>
                  <td className="px-3 py-2 text-xs text-deck-dim">
                    <span className="block max-w-xs truncate" title={d.description || ''}>
                      {d.description || '-'}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedDefects.length === 0 && defects.length > 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-3 py-6 text-center text-sm text-deck-dim">
                    No defects match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
