'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ProjectSpec = { id: string; name: string | null; document_url: string | null }
type StandardDoc = { id: string; code: string; title: string | null; category: string | null }

const CATEGORIES = [
  'Concrete & Masonry',
  'Structural Steel',
  'Fire Protection & Penetrations',
  'Building Regulations & Codes',
  'Mechanical & Electrical',
  'Cladding & Envelope',
  'General',
]

export default function EditProjectPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [standards, setStandards] = useState('')
  const [specs, setSpecs] = useState<ProjectSpec[]>([])
  const [library, setLibrary] = useState<StandardDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data: project } = await supabase
      .from('projects')
      .select('name, description, standards')
      .eq('id', projectId)
      .single()

    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setStandards(project.standards || '')
    }

    const { data: specData } = await supabase
      .from('project_specs')
      .select('id, name, document_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setSpecs(specData || [])

    const { data: libraryData } = await supabase
      .from('standards_library')
      .select('id, code, title, category')
      .order('code', { ascending: true })
    setLibrary(libraryData || [])

    setLoading(false)
  }

  function addStandardCode(code: string) {
    const already = standards.toLowerCase().includes(code.toLowerCase())
    if (already) return
    setStandards((prev) => (prev.trim() ? `${prev.trim()}, ${code}` : code))
  }

  function removeStandardCode(code: string) {
    const parts = standards
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.toLowerCase() !== code.toLowerCase())
    setStandards(parts.join(', '))
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Project name cannot be empty.')
      return
    }
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('projects')
      .update({ name: name.trim(), description, standards })
      .eq('id', projectId)

    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => router.push(`/dashboard/projects/${projectId}`), 700)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  const groupedLibrary = CATEGORIES.map((cat) => ({
    category: cat,
    items: library.filter((s) => (s.category || 'General') === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Edit Project</h1>

        <div className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Project specifications</p>
              <Link
                href={`/dashboard/project-spec?projectId=${projectId}`}
                className="text-xs font-medium text-brand-primary underline"
              >
                Manage specs
              </Link>
            </div>
            {specs.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">No specification documents uploaded yet.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {specs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
                    <span className="text-xs text-slate-700">{s.name}</span>
                    {s.document_url && (
                      <a href={s.document_url} target="_blank" rel="noreferrer" className="text-xs text-brand-primary underline">
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Applicable standards</label>
            <p className="mt-1 text-xs text-slate-400">
              Tap standards from your library below, grouped by category. A standard only feeds into analysis if its code appears here.
            </p>

            {standards && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {standards.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary"
                  >
                    {s}
                    <button onClick={() => removeStandardCode(s)} className="text-brand-primary/70">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-3">
              {groupedLibrary.length === 0 && (
                <p className="text-xs text-slate-400">No standards in your library yet.</p>
              )}
              {groupedLibrary.map((g) => (
                <div key={g.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {g.category}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {g.items.map((s) => {
                      const included = standards.toLowerCase().includes(s.code.toLowerCase())
                      return (
                        <button
                          key={s.id}
                          onClick={() => addStandardCode(s.code)}
                          disabled={included}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                            included
                              ? 'border-green-300 bg-green-50 text-green-700'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        >
                          {included ? `${s.code} ✓` : `+ ${s.code}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-600">
              Additional standards not in your library (comma-separated)
            </label>
            <textarea
              value={standards}
              onChange={(e) => setStandards(e.target.value)}
              rows={3}
              placeholder="e.g. BS 8204 Parts 1-3, BS EN 1090-2..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="text-sm font-medium text-green-600">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
