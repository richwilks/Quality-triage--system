'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
  status: string
  target_close_date: string | null
  ncr_number: string | null
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
      .select('id, title, location, photo_url, status, target_close_date, ncr_number, projects(name)')
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
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="My Companies Details" />
        <p className="mt-1 text-sm text-deck-dim">
          Everything assigned to anyone at your company.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">
            Nothing assigned to your company right now.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {defects.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/defects/${d.id}`}
              className="block rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-deck-dim">{getProjectName(d)}</p>
              {d.ncr_number && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-deck-mute">
                  {d.ncr_number}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-deck-text">{d.title}</p>
                <StatusBadge status={d.status} />
              </div>
              {d.location && <p className="mt-1 text-xs text-deck-dim">{d.location}</p>}
              {d.target_close_date && (
                <p className="mt-1 text-xs text-deck-dim">Due {d.target_close_date}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
