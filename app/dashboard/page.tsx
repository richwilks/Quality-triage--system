'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import { useBranding } from '@/components/BrandingContext'
import StackedBar from '@/components/charts/StackedBar'
import BarList from '@/components/charts/BarList'

type Project = { id: string; name: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']
const BACKLOG_STATUSES = ['draft', 'confirmed', 'assigned']

const QUICK_LINKS = [
  { href: '/dashboard/projects/new', label: 'New Project', primary: true },
  { href: '/dashboard/company-analytics', label: 'Company Performance' },
  { href: '/dashboard/new-defect-video', label: 'From Video' },
  { href: '/dashboard/drawings', label: 'Drawings' },
  { href: '/dashboard/my-defects', label: 'My Assigned' },
  { href: '/dashboard/project-spec', label: 'Project Spec' },
  { href: '/dashboard/standards', label: 'Standards Library' },
  { href: '/dashboard/inspection/active', label: 'Active Inspection' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const branding = useBranding()
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState<Record<string, StatusCounts>>({})
  const [classificationCounts, setClassificationCounts] = useState<{ snag: number; ncr: number }>({ snag: 0, ncr: 0 })
  const [loading, setLoading] = useState(true)
  const [quickAccessOpen, setQuickAccessOpen] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: projectData } = await supabase
      .from('project_members')
      .select('projects(id, name)')
      .eq('user_id', user.id)

    const projectList = (projectData || []).flatMap((row: any) =>
      Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
    )
    setProjects(projectList)

    if (projectList.length > 0) {
      const projectIds = projectList.map((p: Project) => p.id)
      const { data: defectData } = await supabase
        .from('defects')
        .select('project_id, status, classification')
        .in('project_id', projectIds)

      const grouped: Record<string, StatusCounts> = {}
      projectList.forEach((p: Project) => {
        grouped[p.id] = {}
      })
      const classCounts = { snag: 0, ncr: 0 }
      ;(defectData || []).forEach((d: any) => {
        if (!grouped[d.project_id]) grouped[d.project_id] = {}
        grouped[d.project_id][d.status] = (grouped[d.project_id][d.status] || 0) + 1
        if (d.classification === 'snag') classCounts.snag++
        if (d.classification === 'ncr') classCounts.ncr++
      })
      setCounts(grouped)
      setClassificationCounts(classCounts)
    }

    setLoading(false)
  }

  const totalAcrossAll = Object.values(counts).reduce(
    (sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0),
    0
  )

  const backlogOf = (c: StatusCounts) => BACKLOG_STATUSES.reduce((sum, s) => sum + (c[s] || 0), 0)
  const totalBacklog = Object.values(counts).reduce((sum, c) => sum + backlogOf(c), 0)
  const totalClosed = Object.values(counts).reduce((sum, c) => sum + (c.closed || 0), 0)

  const statusSegments = [
    { label: 'Draft', value: Object.values(counts).reduce((s, c) => s + (c.draft || 0), 0), colorClass: 'bg-status-draft' },
    { label: 'Confirmed', value: Object.values(counts).reduce((s, c) => s + (c.confirmed || 0), 0), colorClass: 'bg-status-confirmed' },
    { label: 'Assigned', value: Object.values(counts).reduce((s, c) => s + (c.assigned || 0), 0), colorClass: 'bg-status-assigned' },
    { label: 'Closed', value: totalClosed, colorClass: 'bg-status-closed' },
    { label: 'Rejected', value: Object.values(counts).reduce((s, c) => s + (c.rejected || 0), 0), colorClass: 'bg-status-rejected' },
  ]

  const classificationSegments = [
    { label: 'Snag', value: classificationCounts.snag, colorClass: 'bg-deck-accent' },
    { label: 'NCR', value: classificationCounts.ncr, colorClass: 'bg-red-600' },
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

        <div className="grid grid-cols-2 border-b border-deck-border">
          <div className="border-r border-deck-border p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">
                Projects
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-deck-mute" />
            </div>
            <p className="mt-1.5 font-mono text-3xl font-bold leading-none">
              {String(projects.length).padStart(2, '0')}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">
                Defects
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: totalAcrossAll > 0 ? '#1E7A46' : '#9C9686',
                  boxShadow: totalAcrossAll > 0 ? '0 0 6px #1E7A46' : 'none',
                }}
              />
            </div>
            <p className="mt-1.5 font-mono text-3xl font-bold leading-none">
              {String(totalAcrossAll).padStart(2, '0')}
            </p>
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

        {!loading && projects.length > 0 && totalAcrossAll > 0 && (
          <div className="px-4 pt-5">
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

              <div className="rounded-md border border-deck-border bg-deck-surface p-4">
                <h2 className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Backlog by project</h2>
                <p className="mt-1 text-xs text-deck-dim">{totalBacklog} open (draft, confirmed or assigned) across all your projects.</p>
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
            </div>
          </div>
        )}

        <div className="px-4 pt-5">
          <button
            onClick={() => setQuickAccessOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3.5 py-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Quick Access</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`text-deck-mute transition-transform ${quickAccessOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {quickAccessOpen && (
            <div className="mt-2 overflow-hidden rounded-md border border-deck-border">
              {QUICK_LINKS.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between px-3.5 py-3 text-[13.5px] font-medium ${
                    link.primary ? 'bg-deck-raised text-deck-accent' : 'bg-deck-surface text-deck-text'
                  } ${i < QUICK_LINKS.length - 1 ? 'border-b border-deck-border' : ''}`}
                >
                  <span>{link.label}</span>
                  <span className="font-mono text-deck-mute">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>

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
