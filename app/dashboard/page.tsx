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
    <div className="cmd-deck min-h-screen" style={{ background: '#0B0D10' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .cmd-deck {
          font-family: 'Inter', sans-serif;
          color: #e8eaed;
          -webkit-font-smoothing: antialiased;
        }
        .cmd-deck .mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>

      <div className="mx-auto max-w-md pb-10">
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid #22262C' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="mono flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold"
              style={{ background: '#4FD1C5', color: '#0B0D10' }}
            >
              IQ
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Dashboard</h1>
              <p className="mono mt-0.5 text-[9px] uppercase tracking-wide" style={{ color: '#4E545C' }}>
                inspectiq.co
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/account"
            className="mono text-xs"
            style={{ color: '#8B929C' }}
          >
            MY ACCOUNT
          </Link>
        </div>

        <div className="grid grid-cols-2" style={{ borderBottom: '1px solid #22262C' }}>
          <div className="p-4" style={{ borderRight: '1px solid #22262C' }}>
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-wide" style={{ color: '#4E545C' }}>
                Projects
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#4E545C' }}
              />
            </div>
            <p className="mono mt-1.5 text-3xl font-bold leading-none">
              {String(projects.length).padStart(2, '0')}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-wide" style={{ color: '#4E545C' }}>
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
            <p className="mono mt-1.5 text-3xl font-bold leading-none">
              {String(totalAcrossAll).padStart(2, '0')}
            </p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <Link
            href="/dashboard/new-defect"
            className="flex items-center justify-center gap-2 rounded-md py-3.5 text-sm font-bold"
            style={{ background: '#14171B', border: '1px solid #4FD1C5', color: '#4FD1C5' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            RAISE A NEW DEFECT
          </Link>
        </div>

        <div className="px-4 pt-5">
          <h2 className="mono mb-2.5 text-[10px] uppercase tracking-wide" style={{ color: '#4E545C' }}>
            Quick Access
          </h2>
          <div className="overflow-hidden rounded-md" style={{ border: '1px solid #22262C' }}>
            {QUICK_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-3.5 py-3 text-[13.5px] font-medium"
                style={{
                  background: link.primary ? '#1A1E23' : '#14171B',
                  color: link.primary ? '#4FD1C5' : '#E8EAED',
                  borderBottom: i < QUICK_LINKS.length - 1 ? '1px solid #22262C' : 'none',
                }}
              >
                <span>{link.label}</span>
                <span className="mono" style={{ color: '#4E545C' }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="px-4 pt-6">
          <h2 className="mono mb-2.5 text-[10px] uppercase tracking-wide" style={{ color: '#4E545C' }}>
            My Projects
          </h2>

          {loading && (
            <p className="mono text-xs" style={{ color: '#8B929C' }}>
              LOADING...
            </p>
          )}

          {!loading && projects.length === 0 && (
            <div
              className="rounded-md p-8 text-center"
              style={{ border: '1px solid #22262C', background: '#14171B' }}
            >
              <p className="mono text-xs" style={{ color: '#8B929C' }}>
                NO PROJECTS ASSIGNED
              </p>
              <Link
                href="/dashboard/projects/new"
                className="mt-2 inline-block text-sm font-semibold"
                style={{ color: '#4FD1C5' }}
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
                  className="block rounded-md p-3.5"
                  style={{ background: '#14171B', border: '1px solid #22262C' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: '#E8EAED' }}>
                      {p.name}
                    </p>
                    <span className="mono text-xs" style={{ color: '#4E545C' }}>
                      {total} TOTAL
                    </span>
                  </div>

                  {total === 0 ? (
                    <p className="mono mt-2 text-[11px]" style={{ color: '#4E545C' }}>
                      NO DEFECTS LOGGED YET
                    </p>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {STATUS_ORDER.filter((s) => projectCounts[s] > 0).map((s) => (
                        <div key={s} className="flex items-center gap-1">
                          <StatusBadge status={s} />
                          <span className="mono text-xs font-medium" style={{ color: '#8B929C' }}>
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
