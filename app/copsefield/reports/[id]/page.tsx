'use client'

import { useEffect, useRef, useState } from 'react'
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

const AUTOSAVE_IDLE_MS = 1500
const AUTOSAVE_SAFETY_NET_MS = 20000

export default function CopsefieldReportPage() {
  const supabase = createClient()
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [content, setContent] = useState('')
  const [isStaff, setIsStaff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const contentRef = useRef('')
  const dirtyRef = useRef(false)

  useEffect(() => {
    load()
  }, [reportId])

  useEffect(() => {
    safetyTimer.current = setInterval(() => {
      saveIfDirty()
    }, AUTOSAVE_SAFETY_NET_MS)
    return () => {
      if (safetyTimer.current) clearInterval(safetyTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setContent((data as any)?.content || '')
    contentRef.current = (data as any)?.content || ''
    setLoading(false)
  }

  function handleContentChange(value: string) {
    setContent(value)
    contentRef.current = value
    dirtyRef.current = true
    setDirty(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => saveIfDirty(), AUTOSAVE_IDLE_MS)
  }

  async function saveIfDirty() {
    if (!dirtyRef.current) return
    setSaving(true)
    const { error } = await supabase.from('copsefield_property_reports').update({ content: contentRef.current }).eq('id', reportId)
    if (!error) {
      dirtyRef.current = false
      setDirty(false)
      setLastSavedAt(new Date())
    }
    setSaving(false)
  }

  async function handleTogglePublish() {
    if (!report) return
    await saveIfDirty()
    setPublishing(true)
    const { error } = await supabase
      .from('copsefield_property_reports')
      .update({ published: !report.published })
      .eq('id', report.id)
    if (!error) setReport({ ...report, published: !report.published })
    setPublishing(false)
  }

  async function handlePrint() {
    await saveIfDirty()
    window.print()
  }

  function getBuilding(r: Report) {
    if (!r.copsefield_buildings) return null
    return Array.isArray(r.copsefield_buildings) ? r.copsefield_buildings[0] : r.copsefield_buildings
  }

  function reportTypeLabel(type: string) {
    if (type === 'strata_due_diligence') return 'Strata Due Diligence Report'
    if (type === 'investment') return 'Investment Report'
    return 'Property Report'
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Report not found.</p>
      </div>
    )
  }

  const building = getBuilding(report)

  return (
    <div className="min-h-screen px-4 py-8 print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
          {isStaff && (
            <>
              <span className="mr-auto text-xs text-deck-dim">
                {saving ? 'Saving...' : dirty ? 'Unsaved changes' : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : ''}
              </span>
              <button
                onClick={() => setEditing((prev) => !prev)}
                className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-text"
              >
                {editing ? 'Done editing' : 'Edit'}
              </button>
              <button
                onClick={handleTogglePublish}
                disabled={publishing}
                className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  report.published ? 'border border-deck-border text-deck-text' : 'bg-emerald-600 text-white'
                }`}
              >
                {publishing ? 'Saving...' : report.published ? 'Unpublish' : 'Publish to owner'}
              </button>
            </>
          )}
          <button onClick={handlePrint} className="rounded-md bg-copsefield-accent px-4 py-2 text-sm font-medium text-white">
            Print / Save as PDF
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-deck-border bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="flex items-center justify-between bg-copsefield-dark px-6 py-5 print:bg-copsefield-dark">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 p-1.5">
                <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-full w-full object-contain" />
              </span>
              <span className="text-sm font-bold text-white">Copsefield Group</span>
            </div>
            <div className="text-right text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{reportTypeLabel(report.report_type)}</p>
              {isStaff && (
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium print:hidden ${
                    report.published ? 'bg-emerald-400/90 text-emerald-950' : 'bg-white/20 text-white'
                  }`}
                >
                  {report.published ? 'Published' : 'Draft'}
                </span>
              )}
            </div>
          </div>

          <div className="p-8">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-semibold text-slate-900">{building?.name || report.title}</h1>
              {building?.address && <p className="mt-1 text-sm text-slate-500">{building.address}</p>}
              <p className="mt-2 text-xs text-slate-400">Generated {new Date(report.created_at).toLocaleString('en-GB')}</p>
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

            {isStaff && editing ? (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={28}
                className="mt-6 w-full rounded-md border border-slate-200 p-3 text-sm leading-relaxed text-slate-700 focus:border-copsefield-accent focus:outline-none"
              />
            ) : (
              <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{content}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
