'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']

const QUICK_LINKS = [
  { href: '/dashboard/projects/new', label: 'New project', primary: true },
  { href: '/dashboard/company-analytics', label: 'Company performance' },
  { href: '/dashboard/new-defect-video', label: 'From video' },
  { href: '/dashboard/drawings', label: 'Drawings' },
  { href: '/dashboard/my-defects', label: 'My assigned' },
  { href: '/dashboard/project-spec', label: 'Project spec' },
  { href: '/dashboard/standards', label: 'Standards library' },
  { href: '/dashboard/inspection/active', label: 'Active inspection' },
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
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard" />
          <Link href="/dashboard/account" className="text-sm font-medium text-brand-primary">
            My account
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-ink p-4 text-white">
            <p className="text-2xl font-semibold">{projects.length}</p>
            <p className="mt-0.5 text-xs text-slate-300">Active projects</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold text-slate-900">{totalAcrossAll}</p>
            <p className="mt-0.5 text-xs text-slate-500">Total defects logged</p>
          </div>
        </div>

        <Link
          href="/dashboard/new-defect"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3.5 text-sm font-semibold text-white shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
          Raise a new defect
        </Link>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                link.primary
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-slate-300 text-slate-600'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
          My projects
        </h2>

        {loading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}

        {!loading && projects.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-500">You're not on any projects yet.</p>
            <Link
              href="/dashboard/projects/new"
              className="mt-2 inline-block text-sm font-medium text-brand-primary"
            >
              Create your first project
            </Link>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {projects.map((p) => {
            const projectCounts = counts[p.id] || {}
            const total = Object.values(projectCounts).reduce((a, b) => a + b, 0)

            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <span className="text-xs text-slate-400">{total} total</span>
                </div>

                {total === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No defects logged yet.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUS_ORDER.filter((s) => projectCounts[s] > 0).map((s) => (
                      <div key={s} className="flex items-center gap-1">
                        <StatusBadge status={s} />
                        <span className="text-xs font-medium text-slate-600">
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
  )
}
