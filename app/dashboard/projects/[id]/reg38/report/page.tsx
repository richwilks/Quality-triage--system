'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Report = { id: string; kind: 'status' | 'handover'; content: string; generated_at: string }
type Project = { id: string; name: string; company_name: string | null }
type Branding = {
  feature_branded_reports: boolean
  feature_hide_inspectiq_brand: boolean
  logo_url: string | null
  accent_color: string | null
}

export default function Reg38ReportPage() {
  const supabase = createClient()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const reportId = searchParams.get('reportId')

  const [project, setProject] = useState<Project | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [projectId, reportId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, company_name')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    if (reportId) {
      const { data: reportData } = await supabase
        .from('project_reg38_reports')
        .select('id, kind, content, generated_at')
        .eq('id', reportId)
        .single()
      setReport(reportData)
    }

    if (projectData?.company_name) {
      const { data: brandingData } = await supabase
        .from('company_settings')
        .select('feature_branded_reports, feature_hide_inspectiq_brand, logo_url, accent_color')
        .ilike('company_name', projectData.company_name)
        .maybeSingle()
      setBranding(brandingData)
    }

    setLoading(false)
  }

  const useBrandedReport = branding?.feature_branded_reports || false
  const hideInspectIQ = branding?.feature_hide_inspectiq_brand || false
  const accentColor = useBrandedReport && branding?.accent_color ? branding.accent_color : null
  const logoUrl = useBrandedReport && branding?.logo_url ? branding.logo_url : null

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!project || !report) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Report not found.</p>
      </div>
    )
  }

  const generatedOn = new Date(report.generated_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor || undefined }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: accentColor || undefined }}>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: accentColor || undefined }}>
                {report.kind === 'handover' ? 'Handover Pack' : 'Status Report'} - Regulation 38 / Golden Thread
              </h1>
              <p className="mt-1 text-sm text-slate-500">{project.name}</p>
              {project.company_name && <p className="text-sm text-slate-500">{project.company_name}</p>}
            </div>
            {logoUrl ? (
              <img src={logoUrl} alt={project.company_name || 'Company logo'} className="h-12 w-auto object-contain" />
            ) : !hideInspectIQ ? (
              <img src="/icon-192.png" alt="InspectIQ" className="h-12 w-12 rounded-lg" />
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-400">Generated {generatedOn}</p>

          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.content}</div>

          {!hideInspectIQ && (
            <p className="mt-8 text-center text-[10px] text-slate-300 print:text-slate-400">Generated with InspectIQ</p>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  )
}
