'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string }

export default function RegulatoryProjectPicker({ regime }: { regime: 'reg38' | 'golden_thread' }) {
  const supabase = createClient()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const pageTitle = regime === 'reg38' ? 'Regulation 38' : 'Golden Thread'
  const routeSegment = regime === 'reg38' ? 'reg38' : 'golden-thread'

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

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

    if (projectList.length === 1) {
      router.replace(`/dashboard/projects/${projectList[0].id}/${routeSegment}`)
      return
    }

    setLoading(false)
  }

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
        <PageHeader title={pageTitle} />
        <p className="mt-1 text-sm text-deck-dim">Choose a project to view its {pageTitle} checklist.</p>

        {projects.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">You're not assigned to any projects yet.</p>
        )}

        <div className="mt-4 space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/projects/${p.id}/${routeSegment}`)}
              className="flex w-full items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3 text-left"
            >
              <span className="text-sm font-medium text-deck-text">{p.name}</span>
              <span className="text-deck-mute">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
