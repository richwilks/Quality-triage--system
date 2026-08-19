'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Inspection = {
  id: string
  asset_id: string
  inspection_date: string
  status: string
  notes: string | null
  fmiq_assets: { name: string } | { name: string }[] | null
}

type Finding = {
  id: string
  photo_url: string | null
  description: string | null
  severity: string
  regulation_reference: string | null
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  status: string
  work_order_id: string | null
}

type ChecklistResponse = {
  id: string
  category: string | null
  item_text: string
  mandatory: boolean
  status: 'pending' | 'ok' | 'issue' | 'not_applicable'
  notes: string | null
  photo_url: string | null
  ai_analysis: string | null
  ai_severity: string | null
  analysis_status: 'none' | 'pending' | 'done'
  work_order_id: string | null
}

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'bg-deck-raised text-deck-dim',
  moderate: 'bg-amber-100 text-amber-700',
  major: 'bg-orange-100 text-orange-700',
  hazard: 'bg-red-100 text-red-700',
}

const CHECKLIST_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-deck-raised text-deck-dim',
  ok: 'bg-emerald-100 text-emerald-700',
  issue: 'bg-red-100 text-red-700',
  not_applicable: 'bg-deck-raised text-deck-dim',
}

export default function InspectionDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const inspectionId = params.id as string

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [checklist, setChecklist] = useState<ChecklistResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingWorkOrderFor, setCreatingWorkOrderFor] = useState<string | null>(null)
  const [analyzingAll, setAnalyzingAll] = useState(false)

  useEffect(() => {
    load()
  }, [inspectionId])

  async function load() {
    const { data: inspectionData } = await supabase
      .from('fmiq_inspections')
      .select('id, asset_id, inspection_date, status, notes, fmiq_assets(name)')
      .eq('id', inspectionId)
      .single()
    setInspection(inspectionData as unknown as Inspection)

    const { data: findingsData } = await supabase
      .from('fmiq_inspection_findings')
      .select('id, photo_url, description, severity, regulation_reference, estimated_cost_min, estimated_cost_max, status, work_order_id')
      .eq('inspection_id', inspectionId)
      .order('created_at', { ascending: false })
    setFindings(findingsData || [])

    const { data: checklistData } = await supabase
      .from('fmiq_inspection_checklist_responses')
      .select('id, category, item_text, mandatory, status, notes, photo_url, ai_analysis, ai_severity, analysis_status, work_order_id')
      .eq('inspection_id', inspectionId)
      .order('sort_order', { ascending: true })
    setChecklist(checklistData || [])

    setLoading(false)
  }

  async function handleAnalyzeAllPending() {
    setAnalyzingAll(true)
    setError(null)
    const pending = checklist.filter((c) => c.photo_url && c.analysis_status === 'pending')
    for (const item of pending) {
      try {
        const res = await fetch('/api/fmiq/analyze-checklist-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responseId: item.id }),
        })
        const result = await res.json()
        if (res.ok) {
          setChecklist((prev) =>
            prev.map((c) =>
              c.id === item.id
                ? { ...c, ai_analysis: result.analysis, ai_severity: result.severity, analysis_status: 'done', status: result.status }
                : c
            )
          )
        }
      } catch {
        // Continue with the rest even if one fails
      }
    }
    setAnalyzingAll(false)
  }

  async function handleCreateChecklistWorkOrder(item: ChecklistResponse) {
    if (!inspection) return
    setCreatingWorkOrderFor(item.id)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user?.id)
      .single()

    const description = [item.item_text, item.notes, item.ai_analysis].filter(Boolean).join(' - ')
    const severity = item.ai_severity || 'moderate'

    const { data: workOrder, error: insertError } = await supabase
      .from('fmiq_work_orders')
      .insert({
        asset_id: inspection.asset_id,
        company_name: profile?.company_name,
        title: item.item_text.slice(0, 100),
        description,
        priority: severity === 'hazard' ? 'urgent' : severity === 'major' ? 'high' : 'medium',
        created_by: user?.id,
      })
      .select()
      .single()

    if (!insertError && workOrder) {
      await supabase.from('fmiq_inspection_checklist_responses').update({ work_order_id: workOrder.id }).eq('id', item.id)
      load()
    }
    setCreatingWorkOrderFor(null)
  }

  function getAssetName(i: Inspection) {
    if (!i.fmiq_assets) return ''
    return Array.isArray(i.fmiq_assets) ? i.fmiq_assets[0]?.name : i.fmiq_assets.name
  }

  async function handleGenerateReport() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/fmiq/generate-compliance-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not generate report')
        setGenerating(false)
        return
      }
      router.push(`/fmiq/reports/${result.reportId}`)
    } catch (err: any) {
      setError(err?.message || 'Unexpected error')
      setGenerating(false)
    }
  }

  async function handleCreateWorkOrder(finding: Finding) {
    if (!inspection) return
    setCreatingWorkOrderFor(finding.id)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user?.id)
      .single()

    const { data: workOrder, error: insertError } = await supabase
      .from('fmiq_work_orders')
      .insert({
        asset_id: inspection.asset_id,
        company_name: profile?.company_name,
        title: (finding.description || 'Inspection finding').slice(0, 100),
        description: finding.description,
        priority: finding.severity === 'hazard' ? 'urgent' : finding.severity === 'major' ? 'high' : 'medium',
        created_by: user?.id,
      })
      .select()
      .single()

    if (!insertError && workOrder) {
      await supabase.from('fmiq_inspection_findings').update({ work_order_id: workOrder.id }).eq('id', finding.id)
      load()
    }
    setCreatingWorkOrderFor(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!inspection) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Inspection not found.</p>
      </div>
    )
  }

  const totalMin = findings.reduce((sum, f) => sum + (f.estimated_cost_min || 0), 0)
  const totalMax = findings.reduce((sum, f) => sum + (f.estimated_cost_max || 0), 0)
  const hasEstimates = findings.some((f) => f.estimated_cost_min !== null)

  const pendingAnalysisCount = checklist.filter((c) => c.photo_url && c.analysis_status === 'pending').length
  const checklistByCategory = checklist.reduce<Record<string, ChecklistResponse[]>>((acc, item) => {
    const key = item.category || 'General'
    acc[key] = acc[key] || []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={getAssetName(inspection)} />
        <p className="mt-1 text-sm text-deck-dim">
          Inspected {inspection.inspection_date} ·{' '}
          <span className={inspection.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}>
            {inspection.status === 'completed' ? 'Completed' : 'In progress'}
          </span>
        </p>

        {hasEstimates && (
          <p className="mt-2 text-sm text-deck-body">
            Estimated repair cost: {totalMin.toFixed(0)} - {totalMax.toFixed(0)}
            <span className="ml-1 text-xs text-deck-mute">(AI ballpark, not a quote)</span>
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex-1 rounded-md bg-fmiq-accent px-4 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate compliance report'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {checklist.length > 0 && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">
                Checklist ({checklist.length})
              </h2>
              {pendingAnalysisCount > 0 && (
                <button
                  onClick={handleAnalyzeAllPending}
                  disabled={analyzingAll}
                  className="text-xs font-medium text-fmiq-accent underline disabled:opacity-50"
                >
                  {analyzingAll ? 'Analyzing...' : `Analyze all pending (${pendingAnalysisCount})`}
                </button>
              )}
            </div>

            <div className="mt-2 space-y-4">
              {Object.entries(checklistByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-deck-mute">{category}</h3>
                  <div className="mt-1 space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                        {item.photo_url && (
                          <img src={item.photo_url} alt={item.item_text} className="mb-2 w-full rounded-md" />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-deck-text">
                            {item.item_text}
                            {item.mandatory && <span className="ml-1 text-xs text-deck-mute">(mandatory)</span>}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              CHECKLIST_STATUS_COLOR[item.status] || CHECKLIST_STATUS_COLOR.pending
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                        {item.notes && <p className="mt-1 text-xs text-deck-dim">{item.notes}</p>}
                        {item.analysis_status === 'pending' && (
                          <p className="mt-1 text-xs text-amber-700">Photo attached, not analyzed yet</p>
                        )}
                        {item.ai_analysis && (
                          <div className="mt-1 flex items-start gap-2">
                            {item.ai_severity && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  SEVERITY_COLOR[item.ai_severity] || SEVERITY_COLOR.moderate
                                }`}
                              >
                                {item.ai_severity}
                              </span>
                            )}
                            <p className="text-xs text-deck-dim">{item.ai_analysis}</p>
                          </div>
                        )}
                        {item.status === 'issue' && (
                          item.work_order_id ? (
                            <Link
                              href={`/fmiq/work-orders/${item.work_order_id}`}
                              className="mt-2 inline-block text-xs font-medium text-fmiq-accent underline"
                            >
                              View work order
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleCreateChecklistWorkOrder(item)}
                              disabled={creatingWorkOrderFor === item.id}
                              className="mt-2 text-xs font-medium text-fmiq-accent underline disabled:opacity-50"
                            >
                              {creatingWorkOrderFor === item.id ? 'Creating...' : 'Create work order for this'}
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {findings.length > 0 && (
          <>
        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Findings ({findings.length})
        </h2>

        <div className="mt-2 space-y-2">
          {findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
              {f.photo_url && (
                <img src={f.photo_url} alt="Finding" className="mb-2 w-full rounded-md" />
              )}
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[f.severity] || SEVERITY_COLOR.moderate}`}>
                  {f.severity}
                </span>
                {f.estimated_cost_min !== null && (
                  <span className="text-xs text-deck-dim">
                    Est. {f.estimated_cost_min}-{f.estimated_cost_max}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-deck-text">{f.description}</p>
              {f.regulation_reference && (
                <p className="mt-1 text-xs text-deck-dim">Ref: {f.regulation_reference}</p>
              )}
              {f.work_order_id ? (
                <Link
                  href={`/fmiq/work-orders/${f.work_order_id}`}
                  className="mt-2 inline-block text-xs font-medium text-fmiq-accent underline"
                >
                  View work order
                </Link>
              ) : (
                <button
                  onClick={() => handleCreateWorkOrder(f)}
                  disabled={creatingWorkOrderFor === f.id}
                  className="mt-2 text-xs font-medium text-fmiq-accent underline disabled:opacity-50"
                >
                  {creatingWorkOrderFor === f.id ? 'Creating...' : 'Create work order for this'}
                </button>
              )}
            </div>
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
