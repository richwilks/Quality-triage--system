'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string; description: string | null; company_name: string | null }
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
}
type Branding = {
  feature_branded_reports: boolean
  feature_hide_inspectiq_brand: boolean
  logo_url: string | null
  accent_color: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  closed: 'Closed',
  rejected: 'Rejected',
}

export default function ProjectReportPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

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
      .select('id, name, description, company_name')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    const { data: defectData } = await supabase
      .from('defects')
      .select('id, title, location, photo_url, annotated_photo_url, description, standard_reference, status, target_close_date, closure_notes, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    setDefects(defectData || [])

    if (projectData?.company_name) {
      const { data: brandingData } = await supabase
        .from('company_settings')
        .select('feature_branded_reports, feature_hide_inspectiq_brand, logo_url, accent_color')
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

  const useBrandedReport = branding?.feature_branded_reports || false
  const hideInspectIQ = branding?.feature_hide_inspectiq_brand || false
  const accentColor = useBrandedReport && branding?.accent_color ? branding.accent_color : null
  const logoUrl = useBrandedReport && branding?.logo_url ? branding.logo_url : null

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div>
            <label className="text-xs font-medium text-slate-600">Filter by status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="assigned">Assigned</option>
              <option value="closed">Closed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor || undefined }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div
            className="flex items-start justify-between border-b pb-4"
            style={{ borderColor: accentColor || undefined }}
          >
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: accentColor || undefined }}>
                {project.name}
              </h1>
              {project.company_name && <p className="mt-1 text-sm text-slate-500">{project.company_name}</p>}
              {project.description && <p className="mt-2 text-sm text-slate-600">{project.description}</p>}
            </div>
            {logoUrl ? (
              <img src={logoUrl} alt={project.company_name || 'Company logo'} className="h-12 w-auto object-contain" />
            ) : !hideInspectIQ ? (
              <img src="/icon-192.png" alt="InspectIQ" className="h-12 w-12 rounded-lg" />
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-400">Report generated {generatedOn}</p>

          <div className="mt-4 flex flex-wrap gap-3">
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
                      <p className="text-xs font-medium text-slate-400">Item {i + 1}</p>
                      <p className="text-base font-semibold text-slate-900">{d.title || 'Untitled'}</p>
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
