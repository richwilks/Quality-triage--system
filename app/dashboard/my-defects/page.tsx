'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
  status: string
  target_close_date: string | null
  ncr_number: string | null
  element_type: string | null
  classification: string | null
  created_at: string
  projects: { name: string } | { name: string }[] | null
}

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

type SortKey = 'date_desc' | 'date_asc' | 'type' | 'category' | 'due_date'

const SORT_LABELS: Record<SortKey, string> = {
  due_date: 'Due date',
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  type: 'Type',
  category: 'Category (Snag / NCR)',
}

export default function MyDefectsPage() {
  const supabase = createClient()
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('due_date')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (!myProfile?.company_name) {
      setDefects([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('defects')
      .select(
        'id, title, location, photo_url, status, target_close_date, ncr_number, element_type, classification, created_at, projects(name)'
      )
      .eq('assigned_company_name', myProfile.company_name)
      .order('target_close_date', { ascending: true })

    setDefects((data || []) as unknown as Defect[])
    setLoading(false)
  }

  function getProjectName(d: Defect) {
    if (!d.projects) return ''
    return Array.isArray(d.projects) ? d.projects[0]?.name : d.projects.name
  }

  const sortedDefects = [...defects].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'date_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'type':
        return (ELEMENT_TYPE_LABELS[a.element_type || ''] || a.element_type || '').localeCompare(
          ELEMENT_TYPE_LABELS[b.element_type || ''] || b.element_type || ''
        )
      case 'category':
        return (a.classification || '').localeCompare(b.classification || '')
      case 'due_date':
      default:
        if (!a.target_close_date) return 1
        if (!b.target_close_date) return -1
        return new Date(a.target_close_date).getTime() - new Date(b.target_close_date).getTime()
    }
  })

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
        <PageHeader title="My Companies Details" />
        <p className="mt-1 text-sm text-deck-dim">
          Everything assigned to anyone at your company.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">
            Nothing assigned to your company right now.
          </p>
        )}

        {defects.length > 0 && (
          <div className="mt-4 flex justify-end">
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
          </div>
        )}

        <div className="mt-3 space-y-3">
          {sortedDefects.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/defects/${d.id}`}
              className="block rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-deck-dim">{getProjectName(d)}</p>
              {d.ncr_number && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-deck-mute">
                  {d.ncr_number}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-deck-text">{d.title}</p>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-0.5 text-xs text-deck-dim">
                {[
                  d.element_type ? ELEMENT_TYPE_LABELS[d.element_type] || d.element_type : null,
                  d.classification ? d.classification.toUpperCase() : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {d.location && <p className="mt-1 text-xs text-deck-dim">{d.location}</p>}
              {d.target_close_date && (
                <p className="mt-1 text-xs text-deck-dim">Due {d.target_close_date}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
