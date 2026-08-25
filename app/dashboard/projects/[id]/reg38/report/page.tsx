'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import { createClient } from '@/lib/supabase/client'
import ReportDocument from '@/components/reg38Report/ReportDocument'
import { reportLayoutByKey } from '@/lib/reg38ReportLayouts'
import { renderCustomReportHtml, Reg38ReportSection } from '@/lib/reg38ReportTemplate'

type ReportRow = { id: string; kind: 'status' | 'handover'; content: string; revision: number; generated_at: string }
type Project = {
  id: string
  name: string
  company_name: string | null
  principal_contractor: string | null
  project_address: string | null
  cover_photo_url: string | null
}
type Branding = {
  feature_branded_reports: boolean
  feature_hide_inspectiq_brand: boolean
  logo_url: string | null
  accent_color: string | null
  reg38_report_layout: string | null
  feature_reg38_custom_layout: boolean
  reg38_custom_html_template: string | null
}

export default function Reg38ReportPage() {
  const supabase = createClient()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const reportId = searchParams.get('reportId')

  const [project, setProject] = useState<Project | null>(null)
  const [report, setReport] = useState<ReportRow | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [projectId, reportId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, company_name, principal_contractor, project_address, cover_photo_url')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    if (reportId) {
      const { data: reportData } = await supabase
        .from('project_reg38_reports')
        .select('id, kind, content, revision, generated_at')
        .eq('id', reportId)
        .single()
      setReport(reportData)
    }

    if (projectData?.company_name) {
      const { data: brandingData } = await supabase
        .from('company_settings')
        .select(
          'feature_branded_reports, feature_hide_inspectiq_brand, logo_url, accent_color, reg38_report_layout, feature_reg38_custom_layout, reg38_custom_html_template'
        )
        .ilike('company_name', projectData.company_name)
        .maybeSingle()
      setBranding(brandingData)
    }

    setLoading(false)
  }

  const useBrandedReport = branding?.feature_branded_reports || false
  const hideInspectIQ = branding?.feature_hide_inspectiq_brand || false
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

  let parsed: { executiveSummary: string; sections: Reg38ReportSection[] }
  try {
    const p = JSON.parse(report.content)
    parsed = { executiveSummary: p.executiveSummary || '', sections: Array.isArray(p.sections) ? p.sections : [] }
  } catch {
    parsed = { executiveSummary: '', sections: [{ key: 'report', title: 'Report', body: report.content }] }
  }

  const layout = reportLayoutByKey(branding?.reg38_report_layout)
  const accentColor = (useBrandedReport && branding?.accent_color) || layout.defaultAccent

  const useCustomLayout = !!branding?.feature_reg38_custom_layout && !!branding?.reg38_custom_html_template

  let customHtml: string | null = null
  if (useCustomLayout) {
    const merged = renderCustomReportHtml(branding!.reg38_custom_html_template as string, {
      projectName: project.name,
      companyName: project.company_name || '',
      principalContractor: project.principal_contractor || '',
      projectAddress: project.project_address || '',
      reportDate: generatedOn,
      revision: report.revision,
      reportKind: report.kind === 'handover' ? 'Handover Pack' : 'Status Report',
      coverPhotoUrl: project.cover_photo_url || '',
      logoUrl: logoUrl || '',
      accentColor,
      executiveSummary: parsed.executiveSummary,
      sections: parsed.sections,
    })
    customHtml = DOMPurify.sanitize(merged, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'],
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          {useCustomLayout && customHtml ? (
            <div dangerouslySetInnerHTML={{ __html: customHtml }} />
          ) : (
            <ReportDocument
              layout={layout}
              projectName={project.name}
              companyName={project.company_name}
              principalContractor={project.principal_contractor}
              projectAddress={project.project_address}
              coverPhotoUrl={project.cover_photo_url}
              logoUrl={logoUrl}
              accentColor={accentColor}
              hideInspectIQ={hideInspectIQ}
              kind={report.kind}
              revision={report.revision}
              generatedOn={generatedOn}
              executiveSummary={parsed.executiveSummary}
              sections={parsed.sections}
            />
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}
