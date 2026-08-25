'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'
import MeasurementFields, { MeasurementData } from '@/components/MeasurementFields'
import ClauseViewer from '@/components/ClauseViewer'
import FileDropZone from '@/components/FileDropZone'

type Defect = {
  id: string
  project_id: string
  title: string | null
  location: string | null
  photo_url: string | null
  annotated_photo_url: string | null
  description: string | null
  standard_reference: string | null
  status: string
  target_close_date: string | null
  closure_notes: string | null
  closure_photo_url: string | null
  requires_measurement: boolean | null
  measured_gap_mm: number | null
  tested_detail_reference: string | null
  manufacturer_system: string | null
  classification: string | null
  ncr_number: string | null
  element_type: string | null
  root_cause: string | null
  corrective_action: string | null
  assigned_partner_id: string | null
  assigned_company_name: string | null
}

type Partner = { id: string; full_name: string | null; company_name: string | null }

const STATUS_OPTIONS = ['draft', 'confirmed', 'assigned', 'pending_approval', 'closed', 'rejected']

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  pending_approval: 'Pending approval',
  closed: 'Closed',
  rejected: 'Rejected',
}

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  floor: 'Floor',
  wall: 'Wall',
  ceiling: 'Ceiling',
  structural_steel: 'Structural steel',
  cladding_envelope: 'Cladding / envelope',
  fire_penetration: 'Fire penetration / seal',
  movement_joint: 'Movement joint',
  mep: 'MEP',
  other: 'Other',
}

export default function DefectDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const defectId = params.id as string

  const [defect, setDefect] = useState<Defect | null>(null)
  const [status, setStatus] = useState('')
  const [closureNotes, setClosureNotes] = useState('')
  const [closureFile, setClosureFile] = useState<File | null>(null)
  const [measurement, setMeasurement] = useState<MeasurementData>({
    measuredGapMm: '',
    testedDetailReference: '',
    manufacturerSystem: '',
  })
  const [rootCause, setRootCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedCompany, setAssignedCompany] = useState('')
  const isPartnerViewer = myRole === 'partner'

  useEffect(() => {
    load()
  }, [defectId])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setMyRole(profile?.role || '')
    }

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('role', 'partner')
    setPartners(partnerData || [])

    const { data } = await supabase
      .from('defects')
      .select(
        'id, project_id, title, location, photo_url, annotated_photo_url, description, standard_reference, status, target_close_date, closure_notes, closure_photo_url, requires_measurement, measured_gap_mm, tested_detail_reference, manufacturer_system, classification, ncr_number, element_type, root_cause, corrective_action, assigned_partner_id, assigned_company_name'
      )
      .eq('id', defectId)
      .single()

    if (data) {
      setDefect(data)
      setStatus(data.status)
      setClosureNotes(data.closure_notes || '')
      setMeasurement({
        measuredGapMm: data.measured_gap_mm !== null ? String(data.measured_gap_mm) : '',
        testedDetailReference: data.tested_detail_reference || '',
        manufacturerSystem: data.manufacturer_system || '',
      })
      setRootCause(data.root_cause || '')
      setCorrectiveAction(data.corrective_action || '')
      setAssignedCompany(data.assigned_company_name || '')
    }
    setLoading(false)
  }

  async function notifyCompany(companyName: string, message: string) {
    const recipients = partners.filter((p) => p.company_name === companyName)
    if (recipients.length === 0) return
    await supabase.from('notifications').insert(
      recipients.map((p) => ({
        user_id: p.id,
        defect_id: defectId,
        is_read: false,
        message,
      }))
    )
  }

  async function notifyProjectOwners(projectId: string, message: string) {
    const { data: owners } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('project_role', 'owner')
    if (!owners || owners.length === 0) return
    await supabase.from('notifications').insert(
      owners.map((o) => ({
        user_id: o.user_id,
        defect_id: defectId,
        is_read: false,
        message,
      }))
    )
  }

  async function handleSave(overrideStatus?: string) {
    if (!defect) return
    const nextStatus = overrideStatus || status
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let closurePhotoUrl = defect.closure_photo_url
    if (closureFile) {
      const path = `${defect.id}/${Date.now()}-${closureFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('defect-photos')
        .upload(path, closureFile)
      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('defect-photos').getPublicUrl(path)
        closurePhotoUrl = publicUrl
      }
    }

    const reassigning = !isPartnerViewer && assignedCompany !== (defect.assigned_company_name || '')
    const newPartnerId = reassigning
      ? partners.find((p) => p.company_name === assignedCompany)?.id || null
      : defect.assigned_partner_id

    await supabase
      .from('defects')
      .update({
        status: nextStatus,
        closure_notes: closureNotes || null,
        closure_photo_url: closurePhotoUrl,
        closed_at: nextStatus === 'closed' ? new Date().toISOString() : null,
        measured_gap_mm: measurement.measuredGapMm ? parseFloat(measurement.measuredGapMm) : null,
        tested_detail_reference: measurement.testedDetailReference || null,
        manufacturer_system: measurement.manufacturerSystem || null,
        root_cause: defect.classification === 'ncr' ? rootCause || null : defect.root_cause,
        corrective_action: defect.classification === 'ncr' ? correctiveAction || null : defect.corrective_action,
        ...(reassigning
          ? { assigned_company_name: assignedCompany || null, assigned_partner_id: newPartnerId }
          : {}),
      })
      .eq('id', defect.id)

    if (nextStatus !== defect.status) {
      await supabase.from('defect_history').insert({
        defect_id: defect.id,
        changed_by: user?.id,
        old_status: defect.status,
        new_status: nextStatus,
        notes: closureNotes || null,
      })
    }

    if (reassigning && assignedCompany) {
      await notifyCompany(
        assignedCompany,
        `Your company has been assigned a ${defect.classification === 'ncr' ? 'non-conformance (NCR)' : 'defect'}: ${defect.title || 'Untitled'}`
      )
    }

    if (nextStatus === 'pending_approval' && defect.status !== 'pending_approval') {
      await notifyProjectOwners(
        defect.project_id,
        `${defect.assigned_company_name || 'The assigned company'} marked "${defect.title || 'a defect'}" as fixed - awaiting your approval to close it.`
      )
    }

    if (defect.status === 'pending_approval' && nextStatus !== 'pending_approval' && defect.assigned_company_name) {
      const decisionMessage =
        nextStatus === 'closed'
          ? `Your fix for "${defect.title || 'a defect'}" was approved and the defect is now closed.`
          : `Your fix for "${defect.title || 'a defect'}" was not approved - it's been sent back to you${closureNotes ? `: ${closureNotes}` : '.'}`
      await notifyCompany(defect.assigned_company_name, decisionMessage)
    }

    setSaved(true)
    setSaving(false)

    if (nextStatus === 'closed') {
      setTimeout(() => router.push(`/dashboard/projects/${defect.project_id}`), 700)
    } else {
      load()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!defect) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Defect not found.</p>
      </div>
    )
  }

  const displayPhoto = defect.annotated_photo_url || defect.photo_url
  const isNcr = defect.classification === 'ncr'

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <PageHeader title={defect.title || 'Defect'} />
          <StatusBadge status={defect.status} />
        </div>
        {defect.location && <p className="mt-1 text-sm text-deck-dim">{defect.location}</p>}

        <div className="mt-2 flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isNcr ? 'bg-red-100 text-red-700' : 'bg-deck-raised text-deck-dim'
            }`}
          >
            {isNcr ? 'Non-Conformance (NCR)' : 'Snag'}
          </span>
          {defect.ncr_number && (
            <span className={`text-xs font-medium ${isNcr ? 'text-red-600' : 'text-deck-accent'}`}>
              {defect.ncr_number}
            </span>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          {displayPhoto && (
            <img
              src={displayPhoto}
              alt="Defect"
              className="max-h-64 w-full rounded-md object-cover"
            />
          )}

          <p className="mt-3 text-sm text-deck-body">{defect.description}</p>
          {defect.element_type && (
            <p className="mt-1 text-xs text-deck-dim">
              Element: <span className="font-medium text-deck-body">{ELEMENT_TYPE_LABELS[defect.element_type] || defect.element_type}</span>
            </p>
          )}
          {defect.standard_reference && (
            <>
              <p className="mt-1 text-xs text-deck-dim">Standard: {defect.standard_reference}</p>
              <ClauseViewer projectId={defect.project_id} standardReference={defect.standard_reference} />
            </>
          )}
          {defect.target_close_date && (
            <p className="mt-1 text-xs text-deck-dim">Due {defect.target_close_date}</p>
          )}

          {defect.requires_measurement && (
            <MeasurementFields data={measurement} onChange={(patch) => setMeasurement((prev) => ({ ...prev, ...patch }))} />
          )}

          {isNcr && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-600">
                Non-conformance - root cause and corrective action required for closure
              </p>
              <label className="mt-2 block text-xs font-medium text-deck-body">Root cause</label>
              <textarea
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                rows={2}
                placeholder="Why did this non-conformance occur?"
                className="mt-1 w-full rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
              <label className="mt-2 block text-xs font-medium text-deck-body">Corrective action</label>
              <textarea
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                rows={2}
                placeholder="What needs to happen to resolve this and prevent recurrence?"
                className="mt-1 w-full rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
            </div>
          )}

          <label className="mt-4 block text-sm font-medium text-deck-body">Assigned to</label>
          {isPartnerViewer ? (
            <p className="mt-1 rounded-md bg-deck-raised px-3 py-2 text-sm text-deck-dim">
              {defect.assigned_company_name || 'Not assigned'}
            </p>
          ) : (
            <select
              value={assignedCompany}
              onChange={(e) => setAssignedCompany(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            >
              <option value="">Unassigned</option>
              {Array.from(new Set(partners.map((p) => p.company_name).filter(Boolean))).map((c) => (
                <option key={c as string} value={c as string}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <label className="mt-4 block text-sm font-medium text-deck-body">Status</label>
          {isPartnerViewer ? (
            <p className="mt-1 rounded-md bg-deck-raised px-3 py-2 text-sm text-deck-dim">
              {STATUS_LABELS[status] || status}
              {status === 'pending_approval' && ' - waiting on the project team to approve your fix'}
            </p>
          ) : (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}

          {(() => {
            const canEditClosure = !isPartnerViewer || status === 'assigned'
            return canEditClosure ? (
              <>
                <label className="mt-4 block text-sm font-medium text-deck-body">
                  Response / closure notes
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  rows={3}
                  placeholder="What was done to resolve this, or why it's being rejected"
                  className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                />

                <label className="mt-4 block text-sm font-medium text-deck-body">
                  Evidence photo (optional)
                </label>
                {defect.closure_photo_url && (
                  <img
                    src={defect.closure_photo_url}
                    alt="Closure evidence"
                    className="mt-2 max-h-48 w-full rounded-md object-cover"
                  />
                )}
                <FileDropZone
                  onFiles={(files) => setClosureFile(files[0])}
                  accept="image/*"
                  className="mt-1 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
                >
                  {closureFile ? closureFile.name : 'Choose a photo, or drag and drop it here'}
                </FileDropZone>
              </>
            ) : (
              closureNotes && (
                <>
                  <label className="mt-4 block text-sm font-medium text-deck-body">
                    Response / closure notes
                  </label>
                  <p className="mt-1 text-sm text-deck-body">{closureNotes}</p>
                  {defect.closure_photo_url && (
                    <img
                      src={defect.closure_photo_url}
                      alt="Closure evidence"
                      className="mt-2 max-h-48 w-full rounded-md object-cover"
                    />
                  )}
                </>
              )
            )
          })()}

          {isPartnerViewer ? (
            status === 'assigned' && (
              <button
                onClick={() => handleSave('pending_approval')}
                disabled={saving}
                className="mt-4 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Mark as fixed - send for approval'}
              </button>
            )
          ) : (
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="mt-4 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}
          {saved && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
