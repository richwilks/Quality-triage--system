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
  fmiq_assets: { name: string; location: string | null } | { name: string; location: string | null }[] | null
}

export default function FMIQReportPage() {
  const supabase = createClient()
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [reportId])

  async function load() {
    const { data } = await supabase
      .from('fmiq_property_reports')
      .select('id, report_type, title, content, total_estimated_cost_min, total_estimated_cost_max, created_at, fmiq_assets(name, location)')
      .eq('id', reportId)
      .single()
    setReport(data as unknown as Report)
    setLoading(false)
  }

  function getAsset(r: Report) {
    if (!r.fmiq_assets) return null
    return Array.isArray(r.fmiq_assets) ? r.fmiq_assets[0] : r.fmiq_assets
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

  const asset = getAsset(report)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-md bg-fmiq-accent px-4 py-2 text-sm font-medium text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              {report.report_type === 'investment' ? 'Investment Return Report' : 'Compliance Report'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{asset?.name || report.title}</h1>
            {asset?.location && <p className="mt-1 text-sm text-slate-500">{asset.location}</p>}
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
