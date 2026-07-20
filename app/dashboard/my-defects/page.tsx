'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
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

    const { data: colleagues } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_name', myProfile.company_name)
      .eq('role', 'partner')

    const colleagueIds = (colleagues || []).map((c) => c.id)
    if (colleagueIds.length === 0) {
      setDefects([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('defects')
      .select('id, title, location, photo_url, status, target_close_date, projects(name)')
      .in('assigned_partner_id', colleagueIds)
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
        <h1 className="text-xl font-semibold text-slate-900">My Company's Defects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everything assigned to anyone at your company.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Nothing assigned to your company right now.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {defects.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/defects/${d.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">{getProjectName(d)}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                <StatusBadge status={d.status} />
              </div>
              {d.location && <p className="mt-1 text-xs text-slate-500">{d.location}</p>}
              {d.target_close_date && (
                <p className="mt-1 text-xs text-slate-500">Due {d.target_close_date}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
