'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'

type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
  description: string | null
  standard_reference: string | null
  status: string
  target_close_date: string | null
  projects: { name: string } | { name: string }[] | null
}

export default function MyDefectsPage() {
  const supabase = createClient()
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('defects')
      .select(
        'id, title, location, photo_url, description, standard_reference, status, target_close_date, projects(name)'
      )
      .eq('assigned_partner_id', user.id)
      .order('target_close_date', { ascending: true })

    setDefects((data || []) as unknown as Defect[])
    setLoading(false)
  }

  function getProjectName(d: Defect) {
    if (!d.projects) return ''
    return Array.isArray(d.projects) ? d.projects[0]?.name : d.projects.name
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">My Assigned Defects</h1>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">Nothing assigned to you right now.</p>
        )}

        <div className="mt-6 space-y-3">
          {defects.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">{getProjectName(d)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{d.title}</p>
              {d.location && <p className="text-xs text-slate-500">{d.location}</p>}

              {d.photo_url && (
                <img
                  src={d.photo_url}
                  alt="Defect"
                  className="mt-2 max-h-56 w-full rounded-md object-cover"
                />
              )}

              <p className="mt-2 text-sm text-slate-700">{d.description}</p>
              {d.standard_reference && (
                <p className="mt-1 text-xs text-slate-500">Standard: {d.standard_reference}</p>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <StatusBadge status={d.status} />
                {d.target_close_date && <span>Due {d.target_close_date}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
