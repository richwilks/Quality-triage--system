'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Report = {
  id: string
  title: string
  report_type: string
  published: boolean
  created_at: string
  copsefield_buildings: { name: string } | { name: string }[] | null
}

export default function ReportsPage() {
  const supabase = createClient()
  const [isStaff, setIsStaff] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('copsefield_role').eq('id', user.id).single()
      setIsStaff(profile?.copsefield_role !== 'owner')
    }

    let query = supabase
      .from('copsefield_property_reports')
      .select('id, title, report_type, published, created_at, copsefield_buildings(name)')
      .order('created_at', { ascending: false })

    const { data } = await query
    setReports((data || []) as unknown as Report[])
    setLoading(false)
  }

  function buildingName(rel: Report['copsefield_buildings']) {
    if (!rel) return ''
    return Array.isArray(rel) ? rel[0]?.name : rel.name
  }

  // RLS already hides unpublished reports from owner-portal accounts, but
  // filter defensively too in case a staff member ever ends up viewing
  // this page while impersonating a reduced role.
  const visibleReports = isStaff ? reports : reports.filter((r) => r.published)

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
        <PageHeader title="Reports" />
        {!isStaff && <p className="mt-1 text-sm text-deck-dim">Reports published for your building(s).</p>}

        {visibleReports.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">
            {isStaff ? 'No reports generated yet - create one from a building\'s page.' : 'No reports have been published for your building yet.'}
          </p>
        )}

        <div className="mt-3 space-y-1.5">
          {visibleReports.map((r) => (
            <Link
              key={r.id}
              href={`/copsefield/reports/${r.id}`}
              className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
            >
              <div>
                <p className="text-sm text-deck-text">{buildingName(r.copsefield_buildings) || r.title}</p>
                <p className="text-xs text-deck-dim">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              {isStaff && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.published ? 'bg-emerald-100 text-emerald-700' : 'bg-deck-raised text-deck-dim'
                  }`}
                >
                  {r.published ? 'Published' : 'Draft'}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
