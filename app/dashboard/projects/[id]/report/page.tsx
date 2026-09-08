'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reportLayoutByKey } from '@/lib/reg38ReportLayouts'
import ReportCover from '@/components/reportLayouts/ReportCover'

type Project = {
  id: string
  name: string
  description: string | null
  company_name: string | null
  principal_contractor: string | null
  project_address: string | null
  cover_photo_url: string | null
}
type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
  annotated_photo_url: string | null
  description: string | null
  standard_reference: string | null
  status: string
  target_close_date: string | null
  closure_notes: string | null
  created_at: string
  ncr_number: string | null
}
type Branding = {
  feature_branded_reports: boolean
  feature_hide_inspectiq_brand: boolean
  logo_url: string | null
  accent_color: string | null
  reg38_report_layout: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  pending_approval: 'Pending approval',
  closed: 'Closed',
  rejected: 'Rejected',
}

function ProjectReportPageInner() {
  const supabase = createClient()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const selectedIds = searchParams.get('ids')?.split(',').filter(Boolean) || null

  const [project, setProject] = useState<Project | null>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, description, company_name, principal_contractor, project_address, cover_photo_url')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    let query = supabase
      .from('defects')
      .select('id, title, location, photo_url, annotated_photo_url, description, standard_reference, status, target_close_date, closure_notes, created_at, ncr_number')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (selectedIds) query = query.in('id', selectedIds)

    const { data: defectData } = await query
    setDefects(defectData || [])

    if (projectData?.company_name) {
      const { data: brandingData } = await supabase
        .from('company_settings')
        .select('feature_branded_reports, feature_hide_inspectiq_brand, logo_url, accent_color, reg38_report_layout')
        .eq('company_name', projectData.company_name)
        .maybeSingle()
      setBranding(brandingData)
    }

    setLoading(false)
  }

  const filtered = statusFilter === 'all' ? defects : defects.filter((d) => d.status === statusFilter)
  const counts: Record<string, number> = {}
  defects.forEach((d) => {
    counts[d.status] = (counts[d.status] || 0) + 1
  })

  const generatedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const layout = reportLayoutByKey(branding?.reg38_report_layout)
  const useBrandedReport = branding?.feature_branded_reports || false
  const hideInspectIQ = branding?.feature_hide_inspectiq_brand || false
  const accentColor = (useBrandedReport && branding?.accent_color) || layout.defaultAccent
  const logoUrl = useBrandedReport && branding?.logo_url ? branding.logo_url : null

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {selectedIds ? (
            <p className="text-sm text-slate-600">Showing {defects.length} selected defect{defects.length === 1 ? '' : 's'}</p>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600">Filter by status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor || undefined }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
          style={{ fontFamily: layout.bodyFont }}
        >
          <ReportCover
            layout={layout}
            kicker="Defect &amp; NCR Report"
            title={project.name}
            meta={[
              ...(project.company_name ? [{ label: 'Company', value: project.company_name }] : []),
              ...(project.project_address ? [{ label: 'Address', value: project.project_address }] : []),
              { label: 'Date', value: generatedOn },
              { label: 'Items', value: `${defects.length}${selectedIds ? ' selected' : ''}` },
            ]}
            coverPhotoUrl={project.cover_photo_url}
            logoUrl={logoUrl || (!hideInspectIQ ? '/icon-192.png' : null)}
            logoAlt={logoUrl ? project.company_name || 'Company logo' : 'InspectIQ'}
            accentColor={accentColor}
          />

          <div className="p-8">
          {project.description && <p className="text-sm text-slate-600">{project.description}</p>}

          <div className={project.description ? 'mt-4 flex flex-wrap gap-3' : 'flex flex-wrap gap-3'}>
            {Object.entries(counts).map(([status, count]) => (
              <div key={status} className="rounded-md bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 print:bg-white print:border print:border-slate-300">
                {STATUS_LABEL[status] || status}: {count}
              </div>
            ))}
            <div
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white print:bg-white print:border print:border-slate-900 print:text-slate-900"
              style={{ backgroundColor: accentColor || undefined }}
            >
              Total: {defects.length}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {filtered.map((d, i) => {
              const displayPhoto = d.annotated_photo_url || d.photo_url
              return (
                <div key={d.id} className="break-inside-avoid border-b border-slate-100 pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Item {i + 1}
                        {d.ncr_number && ` · ${d.ncr_number}`}
                      </p>
                      <p className="text-base font-semibold" style={{ fontFamily: layout.headingFont, color: layout.ink }}>
                        {d.title || 'Untitled'}
                      </p>
                      {d.location && <p className="text-sm text-slate-500">{d.location}</p>}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 print:border print:border-slate-400">
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                  </div>

                  {displayPhoto && (
                    <img
                      src={displayPhoto}
                      alt={d.title || 'Defect'}
                      className="mt-3 max-h-64 w-full rounded-md border border-slate-200 object-cover"
                    />
                  )}

                  <p className="mt-3 text-sm text-slate-700">{d.description}</p>
                  {d.standard_reference && (
                    <p className="mt-1 text-xs text-slate-500">Standard: {d.standard_reference}</p>
                  )}
                  {d.target_close_date && (
                    <p className="mt-1 text-xs text-slate-500">Target close: {d.target_close_date}</p>
                  )}
                  {d.closure_notes && (
                    <p className="mt-1 text-xs text-slate-500">Closure notes: {d.closure_notes}</p>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <p className="text-sm text-slate-500">No defects match this filter.</p>
            )}
          </div>

          {!hideInspectIQ && (
            <p className="mt-8 text-center text-[10px] text-slate-300 print:text-slate-400">
              Generated with InspectIQ
            </p>
          )}
          </div>
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

export default function ProjectReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <ProjectReportPageInner />
    </Suspense>
  )
}
