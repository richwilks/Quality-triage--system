'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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

    const { data } = await supabase
      .from('copsefield_property_reports')
      .select('id, title, report_type, published, created_at, copsefield_buildings(name)')
      .order('created_at', { ascending: false })
    setReports((data || []) as unknown as Report[])
    setLoading(false)
  }

  function buildingName(rel: Report['copsefield_buildings']) {
    if (!rel) return ''
    return Array.isArray(rel) ? rel[0]?.name : rel.name
  }

  function typeLabel(type: string) {
    if (type === 'strata_due_diligence') return 'Strata Due Diligence'
    if (type === 'investment') return 'Investment'
    return 'Property'
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
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Reports" />
        {!isStaff && <p className="mt-1 text-sm text-deck-dim">Reports published for your building(s).</p>}

        {visibleReports.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">
            {isStaff ? "No reports generated yet - create one from a building's page." : 'No reports have been published for your building yet.'}
          </p>
        )}

        {visibleReports.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-deck-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                  <th className="px-3 py-2 font-medium">Building</th>
                  <th className="px-3 py-2 font-medium">Report type</th>
                  <th className="px-3 py-2 font-medium">Generated</th>
                  {isStaff && <th className="px-3 py-2 font-medium">Status</th>}
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/copsefield/reports/${r.id}`)}
                    className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                  >
                    <td className="px-3 py-2 font-medium text-deck-text">{buildingName(r.copsefield_buildings) || r.title}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{typeLabel(r.report_type)}</td>
                    <td className="px-3 py-2 text-xs text-deck-dim">{new Date(r.created_at).toLocaleDateString()}</td>
                    {isStaff && (
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.published ? 'bg-emerald-100 text-emerald-700' : 'bg-deck-raised text-deck-dim'
                          }`}
                        >
                          {r.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
