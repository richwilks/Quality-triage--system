'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'

type Project = { id: string; name: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']

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
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState<Record<string, StatusCounts>>({})
  const [loading, setLoading] = useState(true)

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
        .select('project_id, status')
        .in('project_id', projectIds)

      const grouped: Record<string, StatusCounts> = {}
      projectList.forEach((p: Project) => {
        grouped[p.id] = {}
      })
      ;(defectData || []).forEach((d: any) => {
        if (!grouped[d.project_id]) grouped[d.project_id] = {}
        grouped[d.project_id][d.status] = (grouped[d.project_id][d.status] || 0) + 1
      })
      setCounts(grouped)
    }

    setLoading(false)
  }

  const totalAcrossAll = Object.values(counts).reduce(
    (sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0),
    0
  )

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-md pb-10">
        <div className="flex items-center justify-between border-b border-deck-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-deck-accent font-mono text-xs font-bold text-deck-bg">
              IQ
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Dashboard</h1>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-deck-mute">
                inspectiq.co
              </p>
            </div>
          </div>
          <Link href="/dashboard/account" className="font-mono text-xs text-deck-dim">
            MY ACCOUNT
          </Link>
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
                  background: totalAcrossAll > 0 ? '#4FAE7B' : '#4E545C',
                  boxShadow: totalAcrossAll > 0 ? '0 0 6px #4FAE7B' : 'none',
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

        <div className="px-4 pt-5">
          <h2 className="mb-2.5 font-mono text-[10px] uppercase tracking-wide text-deck-mute">
            Quick Access
          </h2>
          <div className="overflow-hidden rounded-md border border-deck-border">
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

          <div className="space-y-2">
            {projects.map((p) => {
              const projectCounts = counts[p.id] || {}
              const total = Object.values(projectCounts).reduce((a, b) => a + b, 0)

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="block rounded-md border border-deck-border bg-deck-surface p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-deck-text">{p.name}</p>
                    <span className="font-mono text-xs text-deck-mute">{total} TOTAL</span>
                  </div>

                  {total === 0 ? (
                    <p className="mt-2 font-mono text-[11px] text-deck-mute">
                      NO DEFECTS LOGGED YET
                    </p>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {STATUS_ORDER.filter((s) => projectCounts[s] > 0).map((s) => (
                        <div key={s} className="flex items-center gap-1">
                          <StatusBadge status={s} />
                          <span className="font-mono text-xs font-medium text-deck-dim">
                            {projectCounts[s]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
