'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type KnowledgeRow = {
  id: string
  title: string
  element_type: string | null
  country: string | null
  applicable_standards: string | null
  defect_description: string
  correct_reference: string | null
  severity_default: string | null
  active: boolean
}

export default function DefectKnowledgeAdminPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<KnowledgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [elementType, setElementType] = useState('')
  const [country, setCountry] = useState('UK')
  const [applicableStandards, setApplicableStandards] = useState('')
  const [defectDescription, setDefectDescription] = useState('')
  const [correctReference, setCorrectReference] = useState('')
  const [severityDefault, setSeverityDefault] = useState('ncr')

  useEffect(() => {
    checkAccessAndLoad()
  }, [])

  async function checkAccessAndLoad() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_platform_admin) {
      setLoading(false)
      return
    }

    setAuthorized(true)
    await load()
    setLoading(false)
  }

  async function load() {
    const { data } = await supabase
      .from('defect_knowledge_base')
      .select('*')
      .order('created_at', { ascending: false })
    setEntries(data || [])
  }

  function resetForm() {
    setTitle('')
    setElementType('')
    setCountry('UK')
    setApplicableStandards('')
    setDefectDescription('')
    setCorrectReference('')
    setSeverityDefault('ncr')
  }

  async function handleAdd() {
    if (!title || !defectDescription) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('defect_knowledge_base').insert({
      title,
      element_type: elementType || null,
      country: country || null,
      applicable_standards: applicableStandards || null,
      defect_description: defectDescription,
      correct_reference: correctReference || null,
      severity_default: severityDefault,
      created_by: user?.id,
    })

    if (insertError) {
      setError(`Could not save: ${insertError.message}`)
    } else {
      resetForm()
      load()
    }
    setSaving(false)
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await supabase.from('defect_knowledge_base').update({ active: !currentActive }).eq('id', id)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('defect_knowledge_base').delete().eq('id', id)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-red-600">You don't have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Defect Knowledge Base" />
        <p className="mt-1 text-sm text-slate-500">
          Shared defect patterns that apply across all projects, matched automatically by country and standard during photo analysis.
        </p>

        <div className="mt-4 space-y-2">
          {entries.length === 0 && (
            <p className="text-sm text-slate-500">No knowledge base entries yet.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {[e.element_type, e.country, e.applicable_standards].filter(Boolean).join(' · ') || 'General'}
                  </p>
                </div>
                <span className={`text-xs font-medium ${e.active ? 'text-green-700' : 'text-slate-400'}`}>
                  {e.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-700"><strong>Wrong:</strong> {e.defect_description}</p>
              {e.correct_reference && (
                <p className="mt-1 text-xs text-slate-700"><strong>Correct:</strong> {e.correct_reference}</p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  onClick={() => handleToggleActive(e.id, e.active)}
                  className="text-xs font-medium text-brand-primary underline"
                >
                  {e.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-xs font-medium text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Add a knowledge entry</p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Inpro movement joint - max expansion"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={elementType}
            onChange={(e) => setElementType(e.target.value)}
            placeholder="Element type, e.g. Movement joint"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country, e.g. UK (leave blank to apply to all)"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={applicableStandards}
            onChange={(e) => setApplicableStandards(e.target.value)}
            placeholder="Applicable standard code, e.g. IPC.3087 (optional)"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={defectDescription}
            onChange={(e) => setDefectDescription(e.target.value)}
            placeholder="What wrong looks like - be specific and visual"
            rows={3}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={correctReference}
            onChange={(e) => setCorrectReference(e.target.value)}
            placeholder="What correct looks like (optional, but recommended)"
            rows={3}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={severityDefault}
            onChange={(e) => setSeverityDefault(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ncr">NCR</option>
            <option value="snag">Snag</option>
          </select>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={saving || !title || !defectDescription}
            className="mt-3 w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
