'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'

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
  const [higherRiskBuilding, setHigherRiskBuilding] = useState(false)
  const [principalContractor, setPrincipalContractor] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
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
      .select('name, description, standards, higher_risk_building, principal_contractor, project_address, cover_photo_url')
      .eq('id', projectId)
      .single()

    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setStandards(project.standards || '')
      setHigherRiskBuilding(!!project.higher_risk_building)
      setPrincipalContractor(project.principal_contractor || '')
      setProjectAddress(project.project_address || '')
      setCoverPhotoUrl(project.cover_photo_url || null)
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

  async function handleCoverPhotoUpload(file: File) {
    setUploadingCover(true)
    setError(null)

    const path = `${projectId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('project-covers').upload(path, file)
    if (uploadError) {
      setError(`Cover photo upload failed: ${uploadError.message}`)
      setUploadingCover(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('project-covers').getPublicUrl(path)
    setCoverPhotoUrl(publicUrl)
    setUploadingCover(false)
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
      .update({
        name: name.trim(),
        description,
        standards,
        higher_risk_building: higherRiskBuilding,
        principal_contractor: principalContractor || null,
        project_address: projectAddress || null,
        cover_photo_url: coverPhotoUrl,
      })
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
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  const groupedLibrary = CATEGORIES.map((cat) => ({
    category: cat,
    items: library.filter((s) => (s.category || 'General') === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Edit Project" />

        <div className="mt-6 space-y-5 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-deck-body">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-deck-body">
              <input
                type="checkbox"
                checked={higherRiskBuilding}
                onChange={(e) => setHigherRiskBuilding(e.target.checked)}
              />
              Higher-Risk Building
            </label>
            <p className="mt-1 text-xs text-deck-dim">
              Residential, 18m+ or 7+ storeys (England). Determines whether Golden Thread record-keeping is shown as a
              legal requirement or recommended practice on the Regulation 38 / Golden Thread page.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-deck-body">Report cover page</p>
            <p className="mt-1 text-xs text-deck-dim">
              Used on the cover of generated Regulation 38 / Golden Thread reports.
            </p>

            {coverPhotoUrl && (
              <img src={coverPhotoUrl} alt="Cover" className="mt-2 h-32 w-full rounded-md object-cover" />
            )}
            <FileDropZone
              onFiles={(files) => handleCoverPhotoUpload(files[0])}
              accept="image/*"
              disabled={uploadingCover}
              className="mt-2 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
            >
              {uploadingCover ? 'Uploading...' : coverPhotoUrl ? 'Replace cover photo, or drag and drop it here' : 'Choose a cover photo, or drag and drop it here'}
            </FileDropZone>

            <label className="mt-3 block text-xs font-medium text-deck-body">Principal contractor</label>
            <input
              type="text"
              value={principalContractor}
              onChange={(e) => setPrincipalContractor(e.target.value)}
              placeholder="e.g. Acme Construction Ltd"
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />

            <label className="mt-2 block text-xs font-medium text-deck-body">Address</label>
            <textarea
              value={projectAddress}
              onChange={(e) => setProjectAddress(e.target.value)}
              rows={2}
              placeholder="Site address"
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-deck-body">Project specifications</p>
              <Link
                href={`/dashboard/project-spec?projectId=${projectId}`}
                className="text-xs font-medium text-deck-accent underline"
              >
                Manage specs
              </Link>
            </div>
            {specs.length === 0 ? (
              <p className="mt-1 text-xs text-deck-dim">No specification documents uploaded yet.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {specs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md bg-deck-raised px-2.5 py-1.5">
                    <span className="text-xs text-deck-body">{s.name}</span>
                    {s.document_url && (
                      <a href={s.document_url} target="_blank" rel="noreferrer" className="text-xs text-deck-accent underline">
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-deck-body">Applicable standards</label>
            <p className="mt-1 text-xs text-deck-dim">
              Tap standards from your library below, grouped by category. A standard only feeds into analysis if its code appears here.
            </p>

            {standards && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {standards.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded-full bg-deck-accent/10 px-2.5 py-1 text-xs font-medium text-deck-accent"
                  >
                    {s}
                    <button onClick={() => removeStandardCode(s)} className="text-deck-accent/70">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-3">
              {groupedLibrary.length === 0 && (
                <p className="text-xs text-deck-dim">No standards in your library yet.</p>
              )}
              {groupedLibrary.map((g) => (
                <div key={g.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-deck-dim">
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
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                              : 'border-deck-border text-deck-body'
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

            <label className="mt-4 block text-xs font-medium text-deck-body">
              Additional standards not in your library (comma-separated)
            </label>
            <textarea
              value={standards}
              onChange={(e) => setStandards(e.target.value)}
              rows={3}
              placeholder="e.g. BS 8204 Parts 1-3, BS EN 1090-2..."
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="text-sm font-medium text-emerald-700">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
