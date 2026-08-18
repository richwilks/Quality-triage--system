'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Asset = {
  id: string
  name: string
  location: string | null
  property_type: string | null
  province: string | null
}

type Row = {
  id: string
  due_date: string
  status: string
  system_type: string
  reference_standard: string
  contractor_name: string | null
  open_deficiencies: number
}

const SYSTEM_LABEL: Record<string, string> = {
  fire_alarm: 'Fire alarm',
  sprinkler: 'Sprinkler',
  extinguisher: 'Extinguisher',
  emergency_lighting: 'Emergency lighting',
  elevator: 'Elevator',
  backflow: 'Backflow prevention',
  generator: 'Generator',
  other: 'Other',
}

export default function ComplianceSummaryPage() {
  const supabase = createClient()
  const params = useParams()
  const propertyId = params.id as string

  const [asset, setAsset] = useState<Asset | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [propertyId])

  async function load() {
    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, property_type, province')
      .eq('id', propertyId)
      .single()
    setAsset(assetData)

    const { data: scheduledData } = await supabase
      .from('fmiq_scheduled_inspections')
      .select(
        'id, due_date, status, assigned_contractor_org_id, fmiq_inspection_frameworks(system_type, reference_standard), fmiq_organizations(name)'
      )
      .eq('property_id', propertyId)
      .order('due_date', { ascending: true })

    const scheduledIds = (scheduledData || []).map((s: any) => s.id)
    let deficiencyCounts: Record<string, number> = {}
    if (scheduledIds.length > 0) {
      const { data: deficiencyData } = await supabase
        .from('fmiq_deficiencies')
        .select('status, fmiq_compliance_records!inner(scheduled_inspection_id)')
        .eq('status', 'open')
        .in('fmiq_compliance_records.scheduled_inspection_id', scheduledIds)

      deficiencyCounts = (deficiencyData || []).reduce((acc: Record<string, number>, d: any) => {
        const record = Array.isArray(d.fmiq_compliance_records) ? d.fmiq_compliance_records[0] : d.fmiq_compliance_records
        const id = record?.scheduled_inspection_id
        if (id) acc[id] = (acc[id] || 0) + 1
        return acc
      }, {})
    }

    const mapped: Row[] = (scheduledData || []).map((s: any) => {
      const framework = Array.isArray(s.fmiq_inspection_frameworks) ? s.fmiq_inspection_frameworks[0] : s.fmiq_inspection_frameworks
      const org = Array.isArray(s.fmiq_organizations) ? s.fmiq_organizations[0] : s.fmiq_organizations
      return {
        id: s.id,
        due_date: s.due_date,
        status: s.status,
        system_type: framework?.system_type || 'other',
        reference_standard: framework?.reference_standard || '',
        contractor_name: org?.name || null,
        open_deficiencies: deficiencyCounts[s.id] || 0,
      }
    })
    setRows(mapped)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Property not found.</p>
      </div>
    )
  }

  const totalOpen = rows.reduce((sum, r) => sum + r.open_deficiencies, 0)
  const overdueCount = rows.filter((r) => r.status !== 'completed' && new Date(r.due_date) < new Date(new Date().toDateString())).length

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
              Compliance Summary
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{asset.name}</h1>
            {asset.location && <p className="mt-1 text-sm text-slate-500">{asset.location}</p>}
            <p className="mt-2 text-xs text-slate-400">
              {asset.province ? `${asset.province} · ` : ''}Generated {new Date().toLocaleString('en-GB')}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-slate-200 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{rows.length}</p>
              <p className="text-xs text-slate-500">Tracked systems</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{overdueCount}</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{totalOpen}</p>
              <p className="text-xs text-slate-500">Open deficiencies</p>
            </div>
          </div>

          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">System</th>
                <th className="py-2 pr-2">Standard</th>
                <th className="py-2 pr-2">Next due</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Contractor</th>
                <th className="py-2">Open items</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium text-slate-900">{SYSTEM_LABEL[r.system_type] || r.system_type}</td>
                  <td className="py-2 pr-2 text-slate-500">{r.reference_standard}</td>
                  <td className="py-2 pr-2 text-slate-700">{r.due_date}</td>
                  <td className="py-2 pr-2 text-slate-700 capitalize">{r.status.replace('_', ' ')}</td>
                  <td className="py-2 pr-2 text-slate-500">{r.contractor_name || '-'}</td>
                  <td className="py-2 text-slate-700">{r.open_deficiencies}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No compliance schedule has been generated for this property yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-6 text-xs text-slate-400">
            Suitable for board packages and owner disclosure. This summary reflects the recurring statutory
            inspection schedule tracked in FMIQ and does not constitute legal or engineering advice.
          </p>
        </div>
      </div>
    </div>
  )
}
