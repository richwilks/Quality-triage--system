'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ScheduledInspection = {
  id: string
  due_date: string
  fmiq_assets: { name: string; location: string | null } | { name: string; location: string | null }[] | null
  fmiq_inspection_frameworks:
    | { system_type: string; reference_standard: string }
    | { system_type: string; reference_standard: string }[]
    | null
}

type ComplianceRecord = {
  id: string
  performed_by_user_id: string | null
  performed_at: string
  observed_condition: string | null
}

type Deficiency = {
  id: string
  description: string
  severity: string
  corrective_action: string | null
  status: string
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

export default function ComplianceCertificatePage() {
  const supabase = createClient()
  const params = useParams()
  const scheduledId = params.id as string

  const [scheduled, setScheduled] = useState<ScheduledInspection | null>(null)
  const [record, setRecord] = useState<ComplianceRecord | null>(null)
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([])
  const [performerName, setPerformerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [scheduledId])

  async function load() {
    const { data: scheduledData } = await supabase
      .from('fmiq_scheduled_inspections')
      .select('id, due_date, fmiq_assets(name, location), fmiq_inspection_frameworks(system_type, reference_standard)')
      .eq('id', scheduledId)
      .single()
    setScheduled(scheduledData as unknown as ScheduledInspection)

    const { data: recordData } = await supabase
      .from('fmiq_compliance_records')
      .select('id, performed_by_user_id, performed_at, observed_condition')
      .eq('scheduled_inspection_id', scheduledId)
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRecord(recordData)

    if (recordData?.performed_by_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', recordData.performed_by_user_id)
        .maybeSingle()
      setPerformerName(profile?.full_name || null)
    }

    if (recordData) {
      const { data: deficiencyData } = await supabase
        .from('fmiq_deficiencies')
        .select('id, description, severity, corrective_action, status')
        .eq('compliance_record_id', recordData.id)
      setDeficiencies(deficiencyData || [])
    }

    setLoading(false)
  }

  function getAsset(s: ScheduledInspection) {
    if (!s.fmiq_assets) return null
    return Array.isArray(s.fmiq_assets) ? s.fmiq_assets[0] : s.fmiq_assets
  }

  function getFramework(s: ScheduledInspection) {
    if (!s.fmiq_inspection_frameworks) return null
    return Array.isArray(s.fmiq_inspection_frameworks) ? s.fmiq_inspection_frameworks[0] : s.fmiq_inspection_frameworks
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!scheduled || !record) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <p className="text-sm text-slate-500">No completed inspection record found for this task.</p>
      </div>
    )
  }

  const asset = getAsset(scheduled)
  const framework = getFramework(scheduled)

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
              Inspection &amp; Testing Certificate
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {framework ? SYSTEM_LABEL[framework.system_type] || framework.system_type : 'System'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{framework?.reference_standard}</p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Property</dt>
              <dd className="text-slate-900">{asset?.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Address</dt>
              <dd className="text-slate-900">{asset?.location || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Scheduled due date</dt>
              <dd className="text-slate-900">{scheduled.due_date}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Performed</dt>
              <dd className="text-slate-900">{new Date(record.performed_at).toLocaleString('en-GB')}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Inspected by</dt>
              <dd className="text-slate-900">{performerName || 'Not recorded'}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observed condition</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {record.observed_condition || 'No notes recorded.'}
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Deficiencies ({deficiencies.length})
            </h2>
            {deficiencies.length === 0 ? (
              <p className="mt-1 text-sm text-slate-700">None found - system passed inspection.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {deficiencies.map((d) => (
                  <li key={d.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">{d.severity}</span>
                      <span className="text-xs capitalize text-slate-500">{d.status.replace('_', ' ')}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{d.description}</p>
                    {d.corrective_action && (
                      <p className="mt-1 text-xs text-slate-500">Recommended action: {d.corrective_action}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex justify-between border-t border-slate-200 pt-4 text-xs text-slate-400">
            <span>Generated by FMIQ {new Date().toLocaleDateString('en-GB')}</span>
            <span>Signature: ______________________</span>
          </div>
        </div>
      </div>
    </div>
  )
}
