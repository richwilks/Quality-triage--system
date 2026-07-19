'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Defect = {
  id: string
  project_id: string
  photo_url: string | null
  ai_description: string | null
  ai_confidence: number | null
  standard_reference: string | null
  description: string | null
  projects: { name: string } | { name: string }[] | null
}

export default function ReviewDefectsPage() {
  const supabase = createClient()

  const [defects, setDefects] = useState<Defect[]>([])
  const [editedText, setEditedText] = useState<Record<string, string>>({})
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
      .select('id, project_id, photo_url, ai_description, ai_confidence, standard_reference, description, projects(name)')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    const list = (data || []) as unknown as Defect[]
    setDefects(list)

    const initialText: Record<string, string> = {}
    list.forEach((d) => {
      initialText[d.id] = d.description || d.ai_description || ''
    })
    setEditedText(initialText)
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

    await supabase
      .from('defects')
      .update({
        status: 'confirmed',
        description: editedText[defect.id],
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', defect.id)

    await supabase.from('defect_history').insert({
      defect_id: defect.id,
      changed_by: user?.id,
      old_status: 'draft',
      new_status: 'confirmed',
    })

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
        <h1 className="text-xl font-semibold text-slate-900">Review Defects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirm or reject each AI-flagged item before it moves forward.
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
                    {busyId === defect.id ? 'Saving...' : 'Confirm defect'}
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
