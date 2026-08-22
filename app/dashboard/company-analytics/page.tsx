'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import StackedBar from '@/components/charts/StackedBar'
import BarList from '@/components/charts/BarList'

type ProjectStats = {
  id: string
  name: string
  total: number
  draft: number
  confirmed: number
  assigned: number
  closed: number
  rejected: number
  snag: number
  ncr: number
}

function backlogOf(p: ProjectStats) {
  return p.draft + p.confirmed + p.assigned
}

export default function CompanyAnalyticsPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [projects, setProjects] = useState<ProjectStats[]>([])
  const [photoCount, setPhotoCount] = useState(0)
  const [avgDaysToClose, setAvgDaysToClose] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_admin, company_name, is_platform_admin')
      .eq('id', user.id)
      .single()

    const isPlatformAdmin = !!profile?.is_platform_admin

    if (!isPlatformAdmin && (!profile?.company_admin || !profile.company_name)) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    setCompanyName(isPlatformAdmin ? 'All companies' : profile!.company_name!)

    // Platform admins already see everything at the database level - mirror
    // that here instead of scoping to their own company, so this page works
    // for them too rather than only ever showing their own company's data.
    const { data: projectData } = isPlatformAdmin
      ? await supabase.from('projects').select('id, name')
      : await supabase.from('projects').select('id, name').ilike('company_name', profile!.company_name!)

    const projectIds = (projectData || []).map((p) => p.id)

    const { data: defectData } = await supabase
      .from('defects')
      .select('project_id, status, classification, created_at, closed_at')
      .in('project_id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000'])

    const stats: Record<string, ProjectStats> = {}
    ;(projectData || []).forEach((p) => {
      stats[p.id] = { id: p.id, name: p.name, total: 0, draft: 0, confirmed: 0, assigned: 0, closed: 0, rejected: 0, snag: 0, ncr: 0 }
    })

    let closedDaysSum = 0
    let closedCount = 0

    ;(defectData || []).forEach((d: any) => {
      const s = stats[d.project_id]
      if (!s) return
      s.total++
      if (d.status === 'draft') s.draft++
      if (d.status === 'confirmed') s.confirmed++
      if (d.status === 'assigned') s.assigned++
      if (d.status === 'closed') {
        s.closed++
        if (d.closed_at && d.created_at) {
          const days = (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000
          closedDaysSum += days
          closedCount++
        }
      }
      if (d.status === 'rejected') s.rejected++
      if (d.classification === 'snag') s.snag++
      if (d.classification === 'ncr') s.ncr++
    })

    setAvgDaysToClose(closedCount > 0 ? closedDaysSum / closedCount : null)
    setProjects(Object.values(stats))

    const { count } = await supabase
      .from('analysis_log')
      .select('id', { count: 'exact', head: true })
      .ilike('company_name', profile.company_name)
    setPhotoCount(count || 0)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">You don't have access to this page.</p>
      </div>
    )
  }

  const totalAll = projects.reduce((sum, p) => sum + p.total, 0)
  const totalClosed = projects.reduce((sum, p) => sum + p.closed, 0)
  const totalBacklog = projects.reduce((sum, p) => sum + backlogOf(p), 0)
  const totalSnag = projects.reduce((sum, p) => sum + p.snag, 0)
  const totalNcr = projects.reduce((sum, p) => sum + p.ncr, 0)

  const statusSegments = [
    { label: 'Draft', value: projects.reduce((s, p) => s + p.draft, 0), colorClass: 'bg-status-draft' },
    { label: 'Confirmed', value: projects.reduce((s, p) => s + p.confirmed, 0), colorClass: 'bg-status-confirmed' },
    { label: 'Assigned', value: projects.reduce((s, p) => s + p.assigned, 0), colorClass: 'bg-status-assigned' },
    { label: 'Closed', value: totalClosed, colorClass: 'bg-status-closed' },
    { label: 'Rejected', value: projects.reduce((s, p) => s + p.rejected, 0), colorClass: 'bg-status-rejected' },
  ]

  const classificationSegments = [
    { label: 'Snag', value: totalSnag, colorClass: 'bg-deck-accent' },
    { label: 'NCR', value: totalNcr, colorClass: 'bg-red-600' },
  ]

  const backlogRows = projects
    .map((p) => ({ key: p.id, label: p.name, value: backlogOf(p), colorClass: 'bg-status-assigned' }))
    .sort((a, b) => b.value - a.value)

  const performanceRows = projects
    .filter((p) => p.total > 0)
    .map((p) => ({
      key: p.id,
      label: p.name,
      value: Math.round((p.closed / p.total) * 100),
      colorClass: 'bg-deck-success',
      formatValue: (v: number) => `${v}%`,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <PageHeader title="Company Performance" />
        <p className="mt-1 text-sm text-deck-dim">{companyName} - across all your projects.</p>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-brand-ink p-4 text-white">
            <p className="text-2xl font-semibold">{totalAll}</p>
            <p className="mt-0.5 text-xs text-white/70">Total defects logged</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">{totalBacklog}</p>
            <p className="mt-0.5 text-xs text-deck-dim">Open backlog</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">
              {avgDaysToClose !== null ? avgDaysToClose.toFixed(1) : '-'}
            </p>
            <p className="mt-0.5 text-xs text-deck-dim">Avg days to close</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">
              {totalAll > 0 ? Math.round((totalClosed / totalAll) * 100) : 0}%
            </p>
            <p className="mt-0.5 text-xs text-deck-dim">Closed out</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-deck-border bg-deck-surface p-4">
          <p className="text-xs text-deck-dim">
            {photoCount} photos analyzed · {totalClosed} of {totalAll} closed out
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Defects by status</h2>
            <div className="mt-3">
              <StackedBar segments={statusSegments} />
            </div>
          </div>

          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Snag vs NCR</h2>
            <div className="mt-3">
              <StackedBar segments={classificationSegments} />
            </div>
          </div>

          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Backlog by project</h2>
            <p className="mt-0.5 text-xs text-deck-dim">Open defects (draft, confirmed or assigned) not yet closed out.</p>
            <div className="mt-3">
              <BarList rows={backlogRows} />
            </div>
          </div>

          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Project performance</h2>
            <p className="mt-0.5 text-xs text-deck-dim">Share of logged defects closed out, by project.</p>
            <div className="mt-3">
              <BarList rows={performanceRows} />
            </div>
          </div>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          By project
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {projects.map((p) => (
            <div key={p.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-deck-text">{p.name}</p>
                <span className="text-xs text-deck-dim">{p.total} total</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.draft > 0 && (
                  <div className="flex items-center gap-1">
                    <StatusBadge status="draft" />
                    <span className="text-xs text-deck-body">{p.draft}</span>
                  </div>
                )}
                {p.confirmed > 0 && (
                  <div className="flex items-center gap-1">
                    <StatusBadge status="confirmed" />
                    <span className="text-xs text-deck-body">{p.confirmed}</span>
                  </div>
                )}
                {p.assigned > 0 && (
                  <div className="flex items-center gap-1">
                    <StatusBadge status="assigned" />
                    <span className="text-xs text-deck-body">{p.assigned}</span>
                  </div>
                )}
                {p.closed > 0 && (
                  <div className="flex items-center gap-1">
                    <StatusBadge status="closed" />
                    <span className="text-xs text-deck-body">{p.closed}</span>
                  </div>
                )}
                {p.rejected > 0 && (
                  <div className="flex items-center gap-1">
                    <StatusBadge status="rejected" />
                    <span className="text-xs text-deck-body">{p.rejected}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
