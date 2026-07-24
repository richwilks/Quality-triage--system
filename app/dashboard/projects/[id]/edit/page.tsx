'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type StandardDoc = { id: string; code: string; title: string | null }

export default function EditProjectPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [standards, setStandards] = useState('')
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

    const { data: libraryData } = await supabase
      .from('standards_library')
      .select('id, code, title')
      .order('code', { ascending: true })
    setLibrary(libraryData || [])

    setLoading(false)
  }

  function addStandardCode(code: string) {
    const already = standards.toLowerCase().includes(code.toLowerCase())
    if (already) return
    setStandards((prev) => (prev.trim() ? `${prev.trim()}, ${code}` : code))
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Edit Project</h1>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
            <label className="block text-sm font-medium text-slate-700">Applicable standards</label>
            <textarea
              value={standards}
              onChange={(e) => setStandards(e.target.value)}
              rows={4}
              placeholder="e.g. BS 8204 Parts 1-3, BS EN 1090-2..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              A standard is only used in analysis if its code from the library below appears in this text.
            </p>
          </div>

          {library.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">Add from your Standards Library</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {library.map((s) => {
                  const included = standards.toLowerCase().includes(s.code.toLowerCase())
                  return (
                    <button
                      key={s.id}
                      onClick={() => addStandardCode(s.code)}
                      disabled={included}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
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
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="text-sm font-medium text-green-600">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
