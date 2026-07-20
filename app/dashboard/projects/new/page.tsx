'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewProjectPage() {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [standards, setStandards] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name) {
      setError('Give the project a name.')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({ name, description, standards, created_by: user.id })
      .select()
      .single()

    if (insertError || !project) {
      setError('Could not create the project. Try again.')
      setSaving(false)
      return
    }

    await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      project_role: 'owner',
    })

    router.push(`/dashboard/projects/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">New Project</h1>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Commercial B - Logistics Hub"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the project and construction type"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Applicable standards</label>
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
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}
