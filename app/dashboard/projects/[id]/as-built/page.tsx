'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string; description: string | null }
type Drawing = { id: string; name: string | null; image_url: string | null }
type Measurement = {
  id: string
  drawing_id: string
  x1: number
  y1: number
  x2: number
  y2: number
  value_mm: number
  label: string | null
  created_by: string | null
  created_at: string
}

function formatMm(valueMm: number): string {
  return valueMm >= 1000 ? `${(valueMm / 1000).toFixed(valueMm % 1000 === 0 ? 0 : 2)} m` : `${valueMm} mm`
}

export default function AsBuiltRecordPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [recordedByName, setRecordedByName] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, description')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    const { data: drawingData } = await supabase
      .from('drawings')
      .select('id, name, image_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    setDrawings(drawingData || [])

    const drawingIds = (drawingData || []).map((d) => d.id)
    if (drawingIds.length > 0) {
      const { data: measurementData } = await supabase
        .from('as_built_measurements')
        .select('id, drawing_id, x1, y1, x2, y2, value_mm, label, created_by, created_at')
        .in('drawing_id', drawingIds)
        .order('created_at', { ascending: true })
      setMeasurements(measurementData || [])

      const userIds = Array.from(new Set((measurementData || []).map((m) => m.created_by).filter(Boolean))) as string[]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        const map: Record<string, string> = {}
        ;(profiles || []).forEach((p) => {
          map[p.id] = p.full_name || 'Unknown user'
        })
        setRecordedByName(map)
      }
    }

    setLoading(false)
  }

  const generatedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

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

  const drawingsWithMeasurements = drawings.filter((d) => measurements.some((m) => m.drawing_id === d.id))

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-sm text-slate-600">
            {measurements.length} as-built dimension{measurements.length === 1 ? '' : 's'} across {drawingsWithMeasurements.length} drawing
            {drawingsWithMeasurements.length === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <p className="mt-1 text-sm text-slate-500">As-built dimension record</p>
              {project.description && <p className="mt-2 text-sm text-slate-600">{project.description}</p>}
            </div>
            <img src="/icon-192.png" alt="InspectIQ" className="h-12 w-12 rounded-lg" />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Generated {generatedOn} — as-built dimensions recorded on site during inspections, for the design team to
            reconcile against the design-stage drawings and for the project's Golden Thread change &amp; compliance
            records.
          </p>

          <div className="mt-8 space-y-10">
            {drawingsWithMeasurements.map((d) => {
              const drawingMeasurements = measurements.filter((m) => m.drawing_id === d.id)
              return (
                <div key={d.id} className="break-inside-avoid">
                  <h2 className="text-base font-semibold text-slate-900">{d.name || 'Untitled drawing'}</h2>

                  {d.image_url && (
                    <div className="relative mt-2 w-full overflow-hidden rounded-md border border-slate-200">
                      <img src={d.image_url} alt={d.name || 'Drawing'} className="w-full" />
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                      >
                        {drawingMeasurements.map((m) => {
                          const dx = m.x2 - m.x1
                          const dy = m.y2 - m.y1
                          const len = Math.hypot(dx, dy) || 1
                          const perpX = (-dy / len) * 1.4
                          const perpY = (dx / len) * 1.4
                          return (
                            <g key={m.id}>
                              <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#1F565C" strokeWidth={0.35} />
                              <line
                                x1={m.x1 - perpX}
                                y1={m.y1 - perpY}
                                x2={m.x1 + perpX}
                                y2={m.y1 + perpY}
                                stroke="#1F565C"
                                strokeWidth={0.35}
                              />
                              <line
                                x1={m.x2 - perpX}
                                y1={m.y2 - perpY}
                                x2={m.x2 + perpX}
                                y2={m.y2 + perpY}
                                stroke="#1F565C"
                                strokeWidth={0.35}
                              />
                            </g>
                          )
                        })}
                      </svg>
                      {drawingMeasurements.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            position: 'absolute',
                            left: `${(m.x1 + m.x2) / 2}%`,
                            top: `${(m.y1 + m.y2) / 2}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          className="whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-900 shadow print:border print:border-slate-300"
                        >
                          {formatMm(m.value_mm)}
                        </div>
                      ))}
                    </div>
                  )}

                  <table className="mt-3 w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-1.5 pr-3 font-medium">Value</th>
                        <th className="py-1.5 pr-3 font-medium">Label</th>
                        <th className="py-1.5 pr-3 font-medium">Recorded by</th>
                        <th className="py-1.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawingMeasurements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-1.5 pr-3 font-medium text-slate-900">{formatMm(m.value_mm)}</td>
                          <td className="py-1.5 pr-3 text-slate-600">{m.label || '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-600">
                            {m.created_by ? recordedByName[m.created_by] || '—' : '—'}
                          </td>
                          <td className="py-1.5 text-slate-600">
                            {new Date(m.created_at).toLocaleDateString('en-GB')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {drawingsWithMeasurements.length === 0 && (
              <p className="text-sm text-slate-500">
                No as-built dimensions recorded yet. Open a drawing and use "Record as-built dimension" during an
                inspection to add one.
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-[10px] text-slate-300 print:text-slate-400">Generated with InspectIQ</p>
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
