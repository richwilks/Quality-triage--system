'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import { useBranding } from '@/components/BrandingContext'
import StackedBar from '@/components/charts/StackedBar'
import BarList from '@/components/charts/BarList'
import MonthlyOpenClosedBar, { MonthlyCount } from '@/components/charts/MonthlyOpenClosedBar'

type Project = { id: string; name: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']
const BACKLOG_STATUSES = ['draft', 'confirmed', 'assigned', 'pending_approval']
const MY_TASKS_MONTHS = 6

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const branding = useBranding()
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState<Record<string, StatusCounts>>({})
  const [classificationCounts, setClassificationCounts] = useState<Record<string, { snag: number; ncr: number }>>({})
  const [closedDaysByProject, setClosedDaysByProject] = useState<Record<string, { sum: number; count: number }>>({})
  const [myTasksMonthly, setMyTasksMonthly] = useState<MonthlyCount[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProjectId, setActiveProjectId] = useState<string | 'all'>('all')

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
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    // Platform admins already bypass per-project RLS at the database level -
    // mirror that here instead of scoping to project_members, so a platform
    // admin's own dashboard shows every project rather than only the ones
    // they happen to have an explicit membership row for.
    let projectList: Project[]
    if (profile?.is_platform_admin) {
      const { data: allProjects } = await supabase.from('projects').select('id, name')
      projectList = allProjects || []
    } else {
      const { data: projectData } = await supabase
        .from('project_members')
        .select('projects(id, name)')
        .eq('user_id', user.id)

      projectList = (projectData || []).flatMap((row: any) =>
        Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
      )
    }
    setProjects(projectList)

    if (projectList.length > 0) {
      const projectIds = projectList.map((p: Project) => p.id)
      const { data: defectData } = await supabase
        .from('defects')
        .select('project_id, status, classification, created_at, closed_at')
        .in('project_id', projectIds)

      const grouped: Record<string, StatusCounts> = {}
      const classGrouped: Record<string, { snag: number; ncr: number }> = {}
      const closedDays: Record<string, { sum: number; count: number }> = {}
      projectList.forEach((p: Project) => {
        grouped[p.id] = {}
        classGrouped[p.id] = { snag: 0, ncr: 0 }
        closedDays[p.id] = { sum: 0, count: 0 }
      })
      ;(defectData || []).forEach((d: any) => {
        if (!grouped[d.project_id]) grouped[d.project_id] = {}
        grouped[d.project_id][d.status] = (grouped[d.project_id][d.status] || 0) + 1
        if (!classGrouped[d.project_id]) classGrouped[d.project_id] = { snag: 0, ncr: 0 }
        if (d.classification === 'snag') classGrouped[d.project_id].snag++
        if (d.classification === 'ncr') classGrouped[d.project_id].ncr++
        if (d.status === 'closed' && d.closed_at && d.created_at) {
          if (!closedDays[d.project_id]) closedDays[d.project_id] = { sum: 0, count: 0 }
          const days = (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000
          closedDays[d.project_id].sum += days
          closedDays[d.project_id].count++
        }
      })
      setCounts(grouped)
      setClassificationCounts(classGrouped)
      setClosedDaysByProject(closedDays)
    }

    // "Assigned to you" - individual assignment (assigned_partner_id), distinct
    // from My Companies Details' company-wide view - so this chart reflects
    // your own workload specifically.
    const sinceMonths: Date[] = []
    const now = new Date()
    for (let i = MY_TASKS_MONTHS - 1; i >= 0; i--) {
      sinceMonths.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    const rangeStart = sinceMonths[0]

    const { data: myTasks } = await supabase
      .from('defects')
      .select('status, created_at, closed_at')
      .eq('assigned_partner_id', user.id)

    const monthly: Record<string, MonthlyCount> = {}
    sinceMonths.forEach((d) => {
      monthly[monthKey(d)] = { monthLabel: d.toLocaleDateString('en-GB', { month: 'short' }), open: 0, closed: 0 }
    })
    ;(myTasks || []).forEach((t: any) => {
      const createdAt = t.created_at ? new Date(t.created_at) : null
      if (createdAt && createdAt >= rangeStart) {
        const key = monthKey(createdAt)
        if (monthly[key]) monthly[key].open++
      }
      if (t.status === 'closed' && t.closed_at) {
        const closedAt = new Date(t.closed_at)
        if (closedAt >= rangeStart) {
          const key = monthKey(closedAt)
          if (monthly[key]) monthly[key].closed++
        }
      }
    })
    setMyTasksMonthly(sinceMonths.map((d) => monthly[monthKey(d)]))

    setLoading(false)
  }

  const totalAcrossAll = Object.values(counts).reduce(
    (sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0),
    0
  )

  const backlogOf = (c: StatusCounts) => BACKLOG_STATUSES.reduce((sum, s) => sum + (c[s] || 0), 0)

  // Combined view aggregates every project; a single project tab scopes every
  // chart down to just that project's counts.
  const scopedProjects = activeProjectId === 'all' ? projects : projects.filter((p) => p.id === activeProjectId)
  const scopedCounts = scopedProjects.map((p) => counts[p.id] || {})
  const scopedClassCounts = scopedProjects.map((p) => classificationCounts[p.id] || { snag: 0, ncr: 0 })
  const scopedClosedDays = scopedProjects.map((p) => closedDaysByProject[p.id] || { sum: 0, count: 0 })

  const scopedBacklog = scopedCounts.reduce((sum, c) => sum + backlogOf(c), 0)
  const scopedClosed = scopedCounts.reduce((sum, c) => sum + (c.closed || 0), 0)
  const scopedTotal = scopedCounts.reduce((sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0), 0)
  const scopedClosedDaysSum = scopedClosedDays.reduce((sum, c) => sum + c.sum, 0)
  const scopedClosedDaysCount = scopedClosedDays.reduce((sum, c) => sum + c.count, 0)
  const scopedAvgDaysToClose = scopedClosedDaysCount > 0 ? scopedClosedDaysSum / scopedClosedDaysCount : null

  const statusSegments = [
    { label: 'Draft', value: scopedCounts.reduce((s, c) => s + (c.draft || 0), 0), colorClass: 'bg-status-draft' },
    { label: 'Confirmed', value: scopedCounts.reduce((s, c) => s + (c.confirmed || 0), 0), colorClass: 'bg-status-confirmed' },
    { label: 'Assigned', value: scopedCounts.reduce((s, c) => s + (c.assigned || 0), 0), colorClass: 'bg-status-assigned' },
    { label: 'Pending approval', value: scopedCounts.reduce((s, c) => s + (c.pending_approval || 0), 0), colorClass: 'bg-status-pendingApproval' },
    { label: 'Closed', value: scopedClosed, colorClass: 'bg-status-closed' },
    { label: 'Rejected', value: scopedCounts.reduce((s, c) => s + (c.rejected || 0), 0), colorClass: 'bg-status-rejected' },
  ]

  const classificationSegments = [
    { label: 'Snag', value: scopedClassCounts.reduce((s, c) => s + c.snag, 0), colorClass: 'bg-deck-accent' },
    { label: 'NCR', value: scopedClassCounts.reduce((s, c) => s + c.ncr, 0), colorClass: 'bg-red-600' },
  ]

  const backlogRows = projects
    .map((p) => ({ key: p.id, label: p.name, value: backlogOf(counts[p.id] || {}), colorClass: 'bg-status-assigned' }))
    .sort((a, b) => b.value - a.value)

  const performanceRows = projects
    .map((p) => {
      const c = counts[p.id] || {}
      const total = Object.values(c).reduce((a, b) => a + b, 0)
      return { key: p.id, label: p.name, total, closed: c.closed || 0 }
    })
    .filter((p) => p.total > 0)
    .map((p) => ({
      key: p.key,
      label: p.label,
      value: Math.round((p.closed / p.total) * 100),
      colorClass: 'bg-deck-success',
      formatValue: (v: number) => `${v}%`,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-md pb-10 lg:max-w-6xl">
        <div className="flex items-center justify-between border-b border-deck-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-deck-accent font-mono text-xs font-bold text-deck-bg">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.companyName || 'Logo'} className="h-full w-full object-contain" />
              ) : (
                'IQ'
              )}
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Dashboard</h1>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-deck-mute">
                {branding.hideDefaultBrand && branding.companyName ? branding.companyName : 'inspectiq.co'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link href="/dashboard/account" className="font-mono text-xs text-deck-dim">
              MY ACCOUNT
            </Link>
          </div>
        </div>

        {!loading && projects.length > 1 && (
          <div className="border-b border-deck-border px-4 py-3">
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveProjectId('all')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeProjectId === 'all'
                    ? 'bg-deck-accent text-deck-bg'
                    : 'border border-deck-border bg-deck-surface text-deck-body'
                }`}
              >
                All projects
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProjectId(p.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeProjectId === p.id
                      ? 'bg-deck-accent text-deck-bg'
                      : 'border border-deck-border bg-deck-surface text-deck-body'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-b border-deck-border p-4 lg:grid-cols-4">
          <div className="rounded-xl bg-brand-ink p-4 text-white">
            <p className="text-2xl font-semibold">{scopedTotal}</p>
            <p className="mt-0.5 text-xs text-white/70">Total defects logged</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">{scopedBacklog}</p>
            <p className="mt-0.5 text-xs text-deck-dim">Open backlog</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">
              {scopedAvgDaysToClose !== null ? scopedAvgDaysToClose.toFixed(1) : '-'}
            </p>
            <p className="mt-0.5 text-xs text-deck-dim">Avg days to close</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">
              {scopedTotal > 0 ? Math.round((scopedClosed / scopedTotal) * 100) : 0}%
            </p>
            <p className="mt-0.5 text-xs text-deck-dim">Closed out</p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <Link
            href="/dashboard/new-defect"
            className="flex items-center justify-center gap-2 rounded-md border border-deck-accent bg-deck-surface py-3.5 text-sm font-bold text-deck-accent"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            RAISE A NEW DEFECT
          </Link>
        </div>

        {!loading && (
          <div className="px-4 pt-5">
            <Link
              href="/dashboard/my-defects"
              className="block rounded-md border border-deck-border bg-deck-surface p-4 hover:bg-deck-raised"
            >
              <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">
                Assigned to you - last {MY_TASKS_MONTHS} months
              </h2>
              <div className="mt-3">
                <MonthlyOpenClosedBar data={myTasksMonthly} />
              </div>
            </Link>
          </div>
        )}

        {!loading && projects.length > 0 && totalAcrossAll > 0 && (
          <div className="px-4 pt-5">
            {scopedTotal === 0 ? (
              <p className="rounded-md border border-deck-border bg-deck-surface p-4 text-xs text-deck-dim">
                No defects logged yet on this project.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-deck-border bg-deck-surface p-4">
                  <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Defects by status</h2>
                  <div className="mt-3">
                    <StackedBar segments={statusSegments} />
                  </div>
                </div>

                <div className="rounded-md border border-deck-border bg-deck-surface p-4">
                  <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Snag vs NCR</h2>
                  <div className="mt-3">
                    <StackedBar segments={classificationSegments} />
                  </div>
                </div>

                {activeProjectId === 'all' && (
                  <>
                    <div className="rounded-md border border-deck-border bg-deck-surface p-4">
                      <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Backlog by project</h2>
                      <p className="mt-1 text-xs text-deck-dim">{scopedBacklog} open (draft, confirmed or assigned) across all your projects.</p>
                      <div className="mt-3">
                        <BarList rows={backlogRows} />
                      </div>
                    </div>

                    <div className="rounded-md border border-deck-border bg-deck-surface p-4">
                      <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Project performance</h2>
                      <p className="mt-1 text-xs text-deck-dim">Share of logged defects closed out, by project.</p>
                      <div className="mt-3">
                        <BarList rows={performanceRows} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="px-4 pt-6">
          <h2 className="mb-2.5 font-mono text-[10px] uppercase tracking-wide text-deck-mute">
            My Projects
          </h2>

          {loading && <p className="font-mono text-xs text-deck-dim">LOADING...</p>}

          {!loading && projects.length === 0 && (
            <div className="rounded-md border border-deck-border bg-deck-surface p-8 text-center">
              <p className="font-mono text-xs text-deck-dim">NO PROJECTS ASSIGNED</p>
              <Link
                href="/dashboard/projects/new"
                className="mt-2 inline-block text-sm font-semibold text-deck-accent"
              >
                Create your first project →
              </Link>
            </div>
          )}

          {projects.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-deck-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-deck-border bg-deck-raised font-mono text-[10px] uppercase tracking-wide text-deck-mute">
                    <th className="px-3.5 py-2.5 font-medium">Project</th>
                    <th className="px-3.5 py-2.5 font-medium">Status breakdown</th>
                    <th className="px-3.5 py-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const projectCounts = counts[p.id] || {}
                    const total = Object.values(projectCounts).reduce((a, b) => a + b, 0)

                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                        className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                      >
                        <td className="px-3.5 py-3 font-semibold text-deck-text">{p.name}</td>
                        <td className="px-3.5 py-3">
                          {total === 0 ? (
                            <span className="font-mono text-[11px] text-deck-mute">NO DEFECTS LOGGED YET</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {STATUS_ORDER.filter((s) => projectCounts[s] > 0).map((s) => (
                                <div key={s} className="flex items-center gap-1">
                                  <StatusBadge status={s} />
                                  <span className="font-mono text-xs font-medium text-deck-dim">{projectCounts[s]}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-xs text-deck-mute">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
