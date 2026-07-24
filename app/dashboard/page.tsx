'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'


type Project = { id: string; name: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']

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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard" />
          <Link href="/dashboard/account" className="text-sm font-medium text-slate-900 underline">
            My account
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/projects/new"
            className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            + New project
          </Link>
          <Link
            href="/dashboard/new-defect"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            + New defect
          </Link>
          <Link
            href="/dashboard/review"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Review queue
          </Link>
          <Link
            href="/dashboard/new-defect-video"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            + From video
          </Link>
          <Link
            href="/dashboard/notifications"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Notifications
          </Link>
          <Link
            href="/dashboard/my-defects"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            My assigned defects
          </Link>
          <Link
            href="/dashboard/drawings"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Drawings
          </Link>
          <Link
            href="/dashboard/project-spec"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Project spec
          </Link>
          <Link
            href="/dashboard/standards"
            className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Standards library
          </Link>
        </div>
<Link
  href="/dashboard/inspection/active"
  className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
>
  Active inspection
</Link>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
          My projects
        </h2>

        {loading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}

        {!loading && projects.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">You're not on any projects yet.</p>
        )}

        <div className="mt-4 space-y-3">
          {projects.map((p) => {
            const projectCounts = counts[p.id] || {}
            const total = Object.values(projectCounts).reduce((a, b) => a + b, 0)

            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
