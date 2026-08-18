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
  province: string | null
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

type ScheduledInspection = {
  id: string
  due_date: string
  status: string
  assigned_contractor_org_id: string | null
  fmiq_inspection_frameworks:
    | { system_type: string; reference_standard: string }
    | { system_type: string; reference_standard: string }[]
    | null
}

type ContractorOrg = {
  id: string
  name: string
  expiry_date: string | null
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
const ASSET_TYPE_TO_APPLIES_TO: Record<string, string> = {
  residential: 'residential_multi_unit',
  commercial: 'commercial',
  mixed_use: 'mixed_use',
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

  const [scheduledInspections, setScheduledInspections] = useState<ScheduledInspection[]>([])
  const [contractorOrgs, setContractorOrgs] = useState<ContractorOrg[]>([])
  const [openDeficiencyCount, setOpenDeficiencyCount] = useState(0)
  const [generatingSchedule, setGeneratingSchedule] = useState(false)
  const [newContractorName, setNewContractorName] = useState('')
  const [addingContractor, setAddingContractor] = useState(false)
  const [complianceError, setComplianceError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [assetId])

  async function load() {
    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, notes, status, property_type, jurisdiction, province')
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

    await loadCompliance()

    setLoading(false)
  }

  async function loadCompliance() {
    const { data: scheduledData } = await supabase
      .from('fmiq_scheduled_inspections')
      .select('id, due_date, status, assigned_contractor_org_id, fmiq_inspection_frameworks(system_type, reference_standard)')
      .eq('property_id', assetId)
      .order('due_date', { ascending: true })
    setScheduledInspections((scheduledData as unknown as ScheduledInspection[]) || [])

    const { data: accessData } = await supabase
      .from('fmiq_property_access')
      .select('org_id, fmiq_organizations(id, name)')
      .eq('property_id', assetId)
      .eq('role', 'contractor')

    const contractorList = ((accessData as any[]) || [])
      .map((row) => (Array.isArray(row.fmiq_organizations) ? row.fmiq_organizations[0] : row.fmiq_organizations))
      .filter(Boolean)

    if (contractorList.length > 0) {
      const { data: credData } = await supabase
        .from('fmiq_contractor_credentials')
        .select('org_id, expiry_date')
        .in(
          'org_id',
          contractorList.map((c: any) => c.id)
        )
      setContractorOrgs(
        contractorList.map((c: any) => ({
          id: c.id,
          name: c.name,
          expiry_date: (credData || []).find((cred: any) => cred.org_id === c.id)?.expiry_date || null,
        }))
      )
    } else {
      setContractorOrgs([])
    }

    const scheduledIds = (scheduledData || []).map((s: any) => s.id)
    if (scheduledIds.length > 0) {
      const { count } = await supabase
        .from('fmiq_deficiencies')
        .select('id, fmiq_compliance_records!inner(scheduled_inspection_id)', { count: 'exact', head: true })
        .eq('status', 'open')
        .in('fmiq_compliance_records.scheduled_inspection_id', scheduledIds)
      setOpenDeficiencyCount(count || 0)
    } else {
      setOpenDeficiencyCount(0)
    }
  }

  async function handleGenerateSchedule() {
    if (!asset?.province || !asset.property_type) return
    setGeneratingSchedule(true)
    setComplianceError(null)

    const appliesTo = ASSET_TYPE_TO_APPLIES_TO[asset.property_type] || 'commercial'

    const { data: jurisdiction } = await supabase
      .from('fmiq_jurisdictions')
      .select('id')
      .eq('province', asset.province)
      .single()

    if (!jurisdiction) {
      setComplianceError('No compliance framework is set up yet for this province.')
      setGeneratingSchedule(false)
      return
    }

    const { data: frameworks } = await supabase
      .from('fmiq_inspection_frameworks')
      .select('id')
      .eq('jurisdiction_id', jurisdiction.id)
      .eq('applies_to', appliesTo)

    if (!frameworks || frameworks.length === 0) {
      setComplianceError('No compliance frameworks found for this property type in this province.')
      setGeneratingSchedule(false)
      return
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    const dueDateStr = dueDate.toISOString().slice(0, 10)

    const { error: insertError } = await supabase.from('fmiq_scheduled_inspections').insert(
      frameworks.map((f) => ({
        property_id: assetId,
        framework_id: f.id,
        due_date: dueDateStr,
        status: 'upcoming',
      }))
    )

    if (insertError) {
      setComplianceError(`Could not generate the schedule: ${insertError.message}`)
      setGeneratingSchedule(false)
      return
    }

    await loadCompliance()
    setGeneratingSchedule(false)
  }

  async function handleAddContractor() {
    if (!newContractorName.trim()) return
    setAddingContractor(true)
    setComplianceError(null)

    let orgId: string | null = null
    const { data: existingOrg } = await supabase
      .from('fmiq_organizations')
      .select('id')
      .eq('name', newContractorName.trim())
      .eq('org_type', 'fls_contractor')
      .maybeSingle()

    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      const { data: newOrg, error: orgError } = await supabase
        .from('fmiq_organizations')
        .insert({ name: newContractorName.trim(), org_type: 'fls_contractor' })
        .select()
        .single()
      if (orgError || !newOrg) {
        setComplianceError(`Could not add contractor: ${orgError?.message || 'unknown error'}`)
        setAddingContractor(false)
        return
      }
      orgId = newOrg.id
    }

    const { error: accessError } = await supabase
      .from('fmiq_property_access')
      .insert({ property_id: assetId, org_id: orgId, role: 'contractor' })

    if (accessError && !accessError.message.includes('duplicate')) {
      setComplianceError(`Could not grant access: ${accessError.message}`)
      setAddingContractor(false)
      return
    }

    setNewContractorName('')
    await loadCompliance()
    setAddingContractor(false)
  }

  async function handleAssignContractor(scheduledInspectionId: string, orgId: string) {
    await supabase
      .from('fmiq_scheduled_inspections')
      .update({ assigned_contractor_org_id: orgId || null })
      .eq('id', scheduledInspectionId)
    await loadCompliance()
  }

  function getFramework(s: ScheduledInspection) {
    if (!s.fmiq_inspection_frameworks) return null
    return Array.isArray(s.fmiq_inspection_frameworks) ? s.fmiq_inspection_frameworks[0] : s.fmiq_inspection_frameworks
  }

  function isOverdue(s: ScheduledInspection) {
    return s.status !== 'completed' && new Date(s.due_date) < new Date(new Date().toDateString())
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

        <h2 className="mt-6 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-deck-dim">
          <span>Compliance</span>
          <div className="flex items-center gap-2 normal-case">
            {openDeficiencyCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {openDeficiencyCount} open deficienc{openDeficiencyCount === 1 ? 'y' : 'ies'}
              </span>
            )}
            {scheduledInspections.length > 0 && (
              <Link href={`/fmiq/portfolio/${assetId}/summary`} className="text-xs font-medium text-fmiq-accent underline">
                Summary
              </Link>
            )}
          </div>
        </h2>

        {!asset.province && (
          <p className="mt-2 text-sm text-deck-dim">
            Set a province for this property (edit it when creating a new property) to enable recurring compliance
            tracking.
          </p>
        )}

        {asset.province && scheduledInspections.length === 0 && (
          <button
            onClick={handleGenerateSchedule}
            disabled={generatingSchedule}
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-4 py-2 text-sm font-medium text-deck-text disabled:opacity-50"
          >
            {generatingSchedule ? 'Generating...' : `Generate compliance schedule (${asset.province})`}
          </button>
        )}

        {complianceError && <p className="mt-2 text-sm text-red-600">{complianceError}</p>}

        {scheduledInspections.length > 0 && (
          <div className="mt-2 space-y-2">
            {scheduledInspections.map((s) => {
              const framework = getFramework(s)
              const overdue = isOverdue(s)
              return (
                <div key={s.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/fmiq/compliance/${s.id}`} className="text-sm font-medium text-deck-text">
                      {framework ? SYSTEM_LABEL[framework.system_type] || framework.system_type : 'System'}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : overdue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-deck-raised text-deck-dim'
                      }`}
                    >
                      {s.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Upcoming'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-deck-dim">
                    {framework?.reference_standard} · Due {s.due_date}
                    {s.status === 'completed' && (
                      <>
                        {' · '}
                        <Link href={`/fmiq/compliance/${s.id}/certificate`} className="font-medium text-fmiq-accent underline">
                          Certificate
                        </Link>
                      </>
                    )}
                  </p>
                  <select
                    value={s.assigned_contractor_org_id || ''}
                    onChange={(e) => handleAssignContractor(s.id, e.target.value)}
                    className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-xs text-deck-text"
                  >
                    <option value="">Unassigned</option>
                    {contractorOrgs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.expiry_date ? ` (license exp. ${c.expiry_date})` : ' (no license on file)'}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {scheduledInspections.length > 0 && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newContractorName}
              onChange={(e) => setNewContractorName(e.target.value)}
              placeholder="Add an FLS contractor by name"
              className="flex-1 rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
            <button
              onClick={handleAddContractor}
              disabled={addingContractor || !newContractorName.trim()}
              className="rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

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
