'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Partner = { id: string; full_name: string | null; company_name: string | null }

type Defect = {
  id: string
  project_id: string
  title: string | null
  photo_url: string | null
  ai_description: string | null
  ai_confidence: number | null
  standard_reference: string | null
  description: string | null
  assigned_partner_id: string | null
  target_close_date: string | null
  projects: { name: string } | { name: string }[] | null
}

export default function ReviewDefectsPage() {
  const supabase = createClient()

  const [defects, setDefects] = useState<Defect[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [editedText, setEditedText] = useState<Record<string, string>>({})
  const [assignedPartner, setAssignedPartner] = useState<Record<string, string>>({})
  const [targetDate, setTargetDate] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadDefects()
  }, [])

  async function loadDefects() {
    setLoading(true)
    const { data } = await supabase
      .from('defects')
      .select(
        'id, project_id, title, photo_url, ai_description, ai_confidence, standard_reference, description, assigned_partner_id, target_close_date, projects(name)'
      )
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    const list = (data || []) as unknown as Defect[]
    setDefects(list)

    const initialText: Record<string, string> = {}
    const initialPartner: Record<string, string> = {}
    const initialDate: Record<string, string> = {}
    list.forEach((d) => {
      initialText[d.id] = d.description || d.ai_description || ''
      initialPartner[d.id] = d.assigned_partner_id || ''
      initialDate[d.id] = d.target_close_date || ''
    })
    setEditedText(initialText)
    setAssignedPartner(initialPartner)
    setTargetDate(initialDate)

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('role', 'partner')
    setPartners(partnerData || [])

    setLoading(false)
  }

  function getProjectName(d: Defect) {
    if (!d.projects) return ''
    return Array.isArray(d.projects) ? d.projects[0]?.name : d.projects.name
  }

  async function handleConfirm(defect: Defect) {
    setBusyId(defect.id)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const partnerId = assignedPartner[defect.id] || null
    const newStatus = partnerId ? 'assigned' : 'confirmed'

    await supabase
      .from('defects')
      .update({
        status: newStatus,
        description: editedText[defect.id],
        assigned_partner_id: partnerId,
        target_close_date: targetDate[defect.id] || null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', defect.id)

    await supabase.from('defect_history').insert({
      defect_id: defect.id,
      changed_by: user?.id,
      old_status: 'draft',
      new_status: newStatus,
    })

    if (partnerId) {
      await supabase.from('notifications').insert({
        user_id: partnerId,
        defect_id: defect.id,
        is_read: false,
        message: `You've been assigned a defect: ${defect.title || editedText[defect.id]}${
          targetDate[defect.id] ? ` (due ${targetDate[defect.id]})` : ''
        }`,
      })
    }

    setDefects((prev) => prev.filter((d) => d.id !== defect.id))
    setBusyId(null)
  }

  async function handleReject(defect: Defect) {
    setBusyId(defect.id)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase
      .from('defects')
      .update({ status: 'rejected' })
      .eq('id', defect.id)

    await supabase.from('defect_history').insert({
      defect_id: defect.id,
      changed_by: user?.id,
      old_status: 'draft',
      new_status: 'rejected',
      notes: rejectReason || null,
    })

    setDefects((prev) => prev.filter((d) => d.id !== defect.id))
    setBusyId(null)
    setRejectingId(null)
    setRejectReason('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
    <PageHeader title="Review Defects" />
        <p className="mt-1 text-sm text-slate-500">
          Confirm or reject each item. Assigning a partner will notify them and move it straight to Assigned.
        </p>

        {defects.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Nothing waiting for review right now.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {defects.map((defect) => (
            <div
              key={defect.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">
                {getProjectName(defect)}
              </p>
              {defect.title && (
                <p className="mt-1 text-sm font-semibold text-slate-900">{defect.title}</p>
              )}

              {defect.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={defect.photo_url}
                  alt="Defect"
                  className="mt-2 max-h-56 w-full rounded-md object-cover"
                />
              )}

              {defect.standard_reference && (
                <p className="mt-2 text-xs text-slate-500">
                  Standard: {defect.standard_reference}
                </p>
              )}
              {defect.ai_confidence !== null && (
                <p className="text-xs text-slate-500">
                  AI confidence: {Math.round((defect.ai_confidence || 0) * 100)}%
                </p>
              )}

              <label className="mt-3 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={editedText[defect.id] || ''}
                onChange={(e) =>
                  setEditedText((prev) => ({ ...prev, [defect.id]: e.target.value }))
                }
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">Assigned</label>
                <select
                  value={assignedPartner[defect.id] || ''}
                  onChange={(e) =>
                    setAssignedPartner((prev) => ({ ...prev, [defect.id]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name || p.full_name || 'Partner'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Target completion
                </label>
                <input
                  type="date"
                  value={targetDate[defect.id] || ''}
                  onChange={(e) =>
                    setTargetDate((prev) => ({ ...prev, [defect.id]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {rejectingId === defect.id ? (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Why is this not a defect?
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. this is within tolerance, or normal finish for this material"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleReject(defect)}
                      disabled={busyId === defect.id}
                      className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busyId === defect.id ? 'Saving...' : 'Confirm rejection'}
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleConfirm(defect)}
                    disabled={busyId === defect.id}
                    className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busyId === defect.id
                      ? 'Saving...'
                      : assignedPartner[defect.id]
                      ? 'Confirm & assign'
                      : 'Confirm defect'}
                  </button>
                  <button
                    onClick={() => setRejectingId(defect.id)}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    Not a defect
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
