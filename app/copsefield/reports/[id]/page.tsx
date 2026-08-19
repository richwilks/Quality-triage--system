'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Report = {
  id: string
  report_type: string
  title: string
  content: string
  total_estimated_cost_min: number | null
  total_estimated_cost_max: number | null
  created_at: string
  published: boolean
  copsefield_buildings: { name: string; address: string | null } | { name: string; address: string | null }[] | null
}

export default function CopsefieldReportPage() {
  const supabase = createClient()
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    load()
  }, [reportId])

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
      .select('id, report_type, title, content, total_estimated_cost_min, total_estimated_cost_max, created_at, published, copsefield_buildings(name, address)')
      .eq('id', reportId)
      .single()
    setReport(data as unknown as Report)
    setLoading(false)
  }

  async function handleTogglePublish() {
    if (!report) return
    setPublishing(true)
    const { error } = await supabase
      .from('copsefield_property_reports')
      .update({ published: !report.published })
      .eq('id', report.id)
    if (!error) setReport({ ...report, published: !report.published })
    setPublishing(false)
  }

  function getBuilding(r: Report) {
    if (!r.copsefield_buildings) return null
    return Array.isArray(r.copsefield_buildings) ? r.copsefield_buildings[0] : r.copsefield_buildings
  }

  function reportTypeLabel(type: string) {
    if (type === 'strata_due_diligence') return 'Strata Due Diligence Report'
    return 'Investment Return Report'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Report not found.</p>
      </div>
    )
  }

  const building = getBuilding(report)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
          {isStaff && (
            <button
              onClick={handleTogglePublish}
              disabled={publishing}
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                report.published ? 'border border-slate-300 text-slate-700' : 'bg-emerald-600 text-white'
              }`}
            >
              {publishing ? 'Saving...' : report.published ? 'Unpublish' : 'Publish to owner'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-md bg-copsefield-accent px-4 py-2 text-sm font-medium text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{reportTypeLabel(report.report_type)}</p>
              {isStaff && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium print:hidden ${
                    report.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {report.published ? 'Published' : 'Draft'}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{building?.name || report.title}</h1>
            {building?.address && <p className="mt-1 text-sm text-slate-500">{building.address}</p>}
            <p className="mt-2 text-xs text-slate-400">
              Generated {new Date(report.created_at).toLocaleString('en-GB')}
            </p>
          </div>

          {report.total_estimated_cost_min !== null && (
            <div className="mt-4 rounded-md bg-amber-50 p-3 print:border print:border-amber-300">
              <p className="text-sm font-medium text-amber-900">
                Total estimated repair cost: {report.total_estimated_cost_min?.toFixed(0)} - {report.total_estimated_cost_max?.toFixed(0)}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                AI-generated ballpark estimate only, not a quote - engage a qualified contractor for accurate pricing.
              </p>
            </div>
          )}

          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {report.content}
          </div>
        </div>
      </div>
    </div>
  )
}
