by'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import PageHeader from '@/components/PageHeader'


type Defect = {
  id: string
  title: string | null
  location: string | null
  photo_url: string | null
  description: string | null
  standard_reference: string | null
  status: string
  target_close_date: string | null
  closure_notes: string | null
  closure_photo_url: string | null
}

const STATUS_OPTIONS = ['draft', 'confirmed', 'assigned', 'closed', 'rejected']

export default function DefectDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const defectId = params.id as string

  const [defect, setDefect] = useState<Defect | null>(null)
  const [status, setStatus] = useState('')
  const [closureNotes, setClosureNotes] = useState('')
  const [closureFile, setClosureFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [defectId])

  async function load() {
    const { data } = await supabase
      .from('defects')
      .select(
        'id, title, location, photo_url, description, standard_reference, status, target_close_date, closure_notes, closure_photo_url'
      )
      .eq('id', defectId)
      .single()

    if (data) {
      setDefect(data)
      setStatus(data.status)
      setClosureNotes(data.closure_notes || '')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!defect) return
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

    await supabase
      .from('defects')
      .update({
        status,
        closure_notes: closureNotes || null,
        closure_photo_url: closurePhotoUrl,
        closed_at: status === 'closed' ? new Date().toISOString() : null,
      })
      .eq('id', defect.id)

    if (status !== defect.status) {
      await supabase.from('defect_history').insert({
        defect_id: defect.id,
        changed_by: user?.id,
        old_status: defect.status,
        new_status: status,
        notes: closureNotes || null,
      })
    }

    setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!defect) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Defect not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-
<PageHeader title="Defect" />
          <StatusBadge status={defect.status} />
        </div>
        {defect.location && <p className="mt-1 text-sm text-slate-500">{defect.location}</p>}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {defect.photo_url && (
            <img
              src={defect.photo_url}
              alt="Defect"
              className="max-h-64 w-full rounded-md object-cover"
            />
          )}

          <p className="mt-3 text-sm text-slate-700">{defect.description}</p>
          {defect.standard_reference && (
            <p className="mt-1 text-xs text-slate-500">Standard: {defect.standard_reference}</p>
          )}
          {defect.target_close_date && (
            <p className="mt-1 text-xs text-slate-500">Due {defect.target_close_date}</p>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Response / closure notes
          </label>
          <textarea
            value={closureNotes}
            onChange={(e) => setClosureNotes(e.target.value)}
            rows={3}
            placeholder="What was done to resolve this, or why it's being rejected"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Evidence photo (optional)
          </label>
          {defect.closure_photo_url && (
            <img
              src={defect.closure_photo_url}
              alt="Closure evidence"
              className="mt-2 max-h-48 w-full rounded-md object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setClosureFile(e.target.files?.[0] || null)}
            className="mt-1 w-full text-sm"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="mt-2 text-sm text-green-600">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
