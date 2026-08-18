'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Asset = {
  id: string
  name: string
  location: string | null
  notes: string | null
  status: string
  property_type: string | null
  jurisdiction: string | null
}
type WorkOrder = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
}
type Inspection = {
  id: string
  inspection_date: string
  status: string
}
type Report = {
  id: string
  report_type: string
  title: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-deck-raised text-deck-dim',
}
const PROPERTY_TYPE_LABEL: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  mixed_use: 'Mixed use',
}

export default function AssetDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const assetId = params.id as string

  const [asset, setAsset] = useState<Asset | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingInvestment, setGeneratingInvestment] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [assetId])

  async function load() {
    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, notes, status, property_type, jurisdiction')
      .eq('id', assetId)
      .single()
    setAsset(assetData)

    const { data: woData } = await supabase
      .from('fmiq_work_orders')
      .select('id, title, status, priority, due_date')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    setWorkOrders(woData || [])

    const { data: inspectionData } = await supabase
      .from('fmiq_inspections')
      .select('id, inspection_date, status')
      .eq('asset_id', assetId)
      .order('inspection_date', { ascending: false })
    setInspections(inspectionData || [])

    const { data: reportData } = await supabase
      .from('fmiq_property_reports')
      .select('id, report_type, title, created_at')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    setReports(reportData || [])

    setLoading(false)
  }

  async function handleGenerateInvestmentReport() {
    setGeneratingInvestment(true)
    setError(null)
    try {
      const res = await fetch('/api/fmiq/generate-investment-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not generate report')
        setGeneratingInvestment(false)
        return
      }
      window.location.href = `/fmiq/reports/${result.reportId}`
    } catch (err: any) {
      setError(err?.message || 'Unexpected error')
      setGeneratingInvestment(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Property not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={asset.name} />
        {asset.location && <p className="mt-1 text-sm text-deck-dim">{asset.location}</p>}
        <p className="mt-1 text-xs text-deck-mute">
          {[
            asset.property_type ? PROPERTY_TYPE_LABEL[asset.property_type] || asset.property_type : null,
            asset.jurisdiction,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {asset.notes && <p className="mt-1 text-xs text-deck-dim">{asset.notes}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/fmiq/inspections/new?assetId=${assetId}`}
            className="rounded-md bg-fmiq-accent px-4 py-2 text-sm font-medium text-deck-bg"
          >
            + New inspection
          </Link>
          <Link
            href={`/fmiq/work-orders/new?assetId=${assetId}`}
            className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-text"
          >
            + New task
          </Link>
          <button
            onClick={handleGenerateInvestmentReport}
            disabled={generatingInvestment}
            className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-text disabled:opacity-50"
          >
            {generatingInvestment ? 'Generating...' : 'Investment report'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Inspections</h2>
        {inspections.length === 0 && (
          <p className="mt-2 text-sm text-deck-dim">No inspections yet.</p>
        )}
        <div className="mt-2 space-y-2">
          {inspections.map((i) => (
            <Link
              key={i.id}
              href={`/fmiq/inspections/${i.id}`}
              className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <p className="text-sm font-medium text-deck-text">{i.inspection_date}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  i.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {i.status === 'completed' ? 'Completed' : 'In progress'}
              </span>
            </Link>
          ))}
        </div>

        {reports.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Reports</h2>
            <div className="mt-2 space-y-2">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/fmiq/reports/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
                >
                  <p className="text-sm font-medium text-deck-text">{r.title}</p>
                  <span className="text-xs text-deck-mute">
                    {r.report_type === 'investment' ? 'Investment' : 'Compliance'}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Tasks</h2>

        {workOrders.length === 0 && (
          <p className="mt-2 text-sm text-deck-dim">No tasks logged yet.</p>
        )}

        <div className="mt-2 space-y-2">
          {workOrders.map((w) => (
            <Link
              key={w.id}
              href={`/fmiq/work-orders/${w.id}`}
              className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-deck-text">{w.title}</p>
                {w.due_date && <p className="text-xs text-deck-dim">Due {w.due_date}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[w.status] || STATUS_COLOR.open}`}>
                {STATUS_LABEL[w.status] || w.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
