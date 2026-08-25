'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture from '@/components/CameraCapture'
import PolygonBoxEditor, { Point } from '@/components/PolygonBoxEditor'
import FileDropZone from '@/components/FileDropZone'

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
  photo_url: string | null
  source: 'manual' | 'project'
  company_name: string | null
  source_defect_id: string | null
}

const DEFAULT_POLYGON: Point[] = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 65 },
  { x: 35, y: 65 },
]

type ImportRow = {
  title: string
  element_type: string
  country: string
  applicable_standards: string
  defect_description: string
}

type ImportResult = { row: number; title: string; status: 'success' | 'error'; error?: string }

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase())
  const rows: ImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const row: any = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push({
      title: row.title || '',
      element_type: row.element_type || '',
      country: row.country || '',
      applicable_standards: row.applicable_standards || '',
      defect_description: row.defect_description || '',
    })
  }

  return rows
}

export default function DefectKnowledgeAdminPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<KnowledgeRow[]>([])
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
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

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<Point[]>(DEFAULT_POLYGON)
  const [showCamera, setShowCamera] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null)

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

  async function burnPolygonIntoPhoto(imageUrl: string, points: Point[]): Promise<Blob | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        clearTimeout(timer)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0)

          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = Math.max(3, canvas.width * 0.004)
          ctx.beginPath()
          points.forEach((p, i) => {
            const px = (p.x / 100) * canvas.width
            const py = (p.y / 100) * canvas.height
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          ctx.closePath()
          ctx.stroke()

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }
      img.src = imageUrl
    })
  }

  function resetForm() {
    setTitle('')
    setElementType('')
    setCountry('UK')
    setApplicableStandards('')
    setDefectDescription('')
    setCorrectReference('')
    setSeverityDefault('ncr')
    setPhotoFile(null)
    setPhotoPreview(null)
    setPolygonPoints(DEFAULT_POLYGON)
  }

  function applySelectedPhoto(selected: File) {
    setPhotoFile(selected)
    setPolygonPoints(DEFAULT_POLYGON)
    setPhotoPreview(URL.createObjectURL(selected))
  }

  async function handleAdd() {
    if (!title || !defectDescription) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    let photoUrl: string | null = null
    if (photoFile && photoPreview) {
      const burned = await burnPolygonIntoPhoto(photoPreview, polygonPoints)
      if (!burned) {
        setError('Could not process the reference photo - try again.')
        setSaving(false)
        return
      }
      const path = `${Date.now()}-${photoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('defect-knowledge-photos')
        .upload(path, burned, { contentType: 'image/jpeg' })
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`)
        setSaving(false)
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('defect-knowledge-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }

    const { error: insertError } = await supabase.from('defect_knowledge_base').insert({
      title,
      element_type: elementType || null,
      country: country || null,
      applicable_standards: applicableStandards || null,
      defect_description: defectDescription,
      correct_reference: correctReference || null,
      severity_default: severityDefault,
      photo_url: photoUrl,
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

  function handleCsvSelect(files: File[]) {
    const file = files[0] || null
    setCsvFile(file)
    setImportResults(null)
    setImportPreview([])

    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsed = parseCSV(text)
      setImportPreview(parsed)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (importPreview.length === 0) return
    setImporting(true)
    setImportResults(null)

    const { data: { user } } = await supabase.auth.getUser()
    const results: ImportResult[] = []

    for (let i = 0; i < importPreview.length; i++) {
      const row = importPreview[i]

      if (!row.title.trim() || !row.defect_description.trim()) {
        results.push({
          row: i + 2,
          title: row.title || '(missing title)',
          status: 'error',
          error: 'Missing required title or defect_description',
        })
        continue
      }

      const { error: insertError } = await supabase.from('defect_knowledge_base').insert({
        title: row.title.trim(),
        element_type: row.element_type.trim() || null,
        country: row.country.trim() || null,
        applicable_standards: row.applicable_standards.trim() || null,
        defect_description: row.defect_description.trim(),
        correct_reference: null,
        severity_default: 'ncr',
        created_by: user?.id,
      })

      if (insertError) {
        results.push({ row: i + 2, title: row.title, status: 'error', error: insertError.message })
      } else {
        results.push({ row: i + 2, title: row.title, status: 'success' })
      }
    }

    setImportResults(results)
    setImporting(false)
    setCsvFile(null)
    setImportPreview([])
    load()
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) =>
      [e.title, e.element_type, e.country, e.applicable_standards, e.defect_description, e.company_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    )
  }, [entries, search])

  const groupedEntries = useMemo(() => {
    const byCategory = new Map<string, KnowledgeRow[]>()
    filteredEntries.forEach((e) => {
      const category = e.element_type || 'General'
      if (!byCategory.has(category)) byCategory.set(category, [])
      byCategory.get(category)!.push(e)
    })
    return Array.from(byCategory.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [filteredEntries])

  function toggleCategory(category: string) {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-red-600">You don't have access to this page.</p>
      </div>
    )
  }

  const successCount = importResults?.filter((r) => r.status === 'success').length || 0
  const errorCount = importResults?.filter((r) => r.status === 'error').length || 0

  return (
    <div className="min-h-screen px-4 py-8">
      {showCamera && (
        <CameraCapture
          onCapture={(captured: File) => {
            setShowCamera(false)
            applySelectedPhoto(captured)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <div className="mx-auto max-w-md">
        <PageHeader title="Defect Knowledge Base" />
        <p className="mt-1 text-sm text-deck-dim">
          Shared defect patterns that apply across all projects, matched automatically by country and standard during photo analysis.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Add a single entry</p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Inpro movement joint - max expansion"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={elementType}
            onChange={(e) => setElementType(e.target.value)}
            placeholder="Element type, e.g. Movement joint"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country, e.g. UK (leave blank to apply to all)"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={applicableStandards}
            onChange={(e) => setApplicableStandards(e.target.value)}
            placeholder="Applicable standard code, e.g. IPC.3087 (optional)"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <textarea
            value={defectDescription}
            onChange={(e) => setDefectDescription(e.target.value)}
            placeholder="What wrong looks like - be specific and visual"
            rows={3}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <textarea
            value={correctReference}
            onChange={(e) => setCorrectReference(e.target.value)}
            placeholder="What correct looks like (optional, but recommended)"
            rows={3}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <select
            value={severityDefault}
            onChange={(e) => setSeverityDefault(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          >
            <option value="ncr">NCR</option>
            <option value="snag">Snag</option>
          </select>

          <div className="mt-3">
            <label className="block text-sm font-medium text-deck-body">
              Reference photo (optional, but recommended)
            </label>
            <p className="mt-0.5 text-xs text-deck-dim">
              Draw a polygon around the exact defect area - it's burned into the photo and given to the AI
              alongside the text description, so it can visually compare against what you've highlighted.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
              >
                Take photo
              </button>
              <FileDropZone
                onFiles={(files) => applySelectedPhoto(files[0])}
                accept="image/*"
                className="flex-1 cursor-pointer rounded-md border border-deck-border px-3 py-2 text-center text-sm font-medium text-deck-text"
              >
                Choose from library
              </FileDropZone>
            </div>
            {photoPreview && (
              <div className="relative mt-2 w-full">
                <img src={photoPreview} alt="Reference preview" className="w-full rounded-md" />
                <PolygonBoxEditor points={polygonPoints} onChange={setPolygonPoints} />
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={saving || !title || !defectDescription}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add entry'}
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Bulk import from CSV</p>
          <p className="mt-1 text-xs text-deck-dim">
            Columns required: <span className="font-mono">title, element_type, country, applicable_standards, defect_description</span>. Only <span className="font-mono">title</span> and <span className="font-mono">defect_description</span> are required per row - the rest can be left blank.
          </p>

          <FileDropZone
            onFiles={handleCsvSelect}
            accept=".csv"
            className="mt-3 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
          >
            {csvFile ? csvFile.name : 'Choose a CSV, or drag and drop it here'}
          </FileDropZone>

          {importPreview.length > 0 && (
            <div className="mt-3 rounded-md border border-deck-border bg-deck-raised p-3">
              <p className="text-xs font-medium text-deck-body">
                {importPreview.length} row{importPreview.length === 1 ? '' : 's'} found
              </p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {importPreview.slice(0, 5).map((row, i) => (
                  <p key={i} className="text-xs text-deck-dim truncate">
                    {i + 1}. {row.title || '(no title)'}
                  </p>
                ))}
                {importPreview.length > 5 && (
                  <p className="text-xs text-deck-dim">...and {importPreview.length - 5} more</p>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import ${importPreview.length} entries`}
              </button>
            </div>
          )}

          {importResults && (
            <div className="mt-3 rounded-md border border-deck-border p-3">
              <p className="text-xs font-medium text-deck-body">
                {successCount} imported, {errorCount} failed
              </p>
              {errorCount > 0 && (
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                  {importResults
                    .filter((r) => r.status === 'error')
                    .map((r, i) => (
                      <p key={i} className="text-xs text-red-600">
                        Row {r.row} ({r.title}): {r.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, element type, country, standard, or company..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />

          {entries.length === 0 && (
            <p className="mt-3 text-sm text-deck-dim">No knowledge base entries yet.</p>
          )}
          {entries.length > 0 && filteredEntries.length === 0 && (
            <p className="mt-3 text-sm text-deck-dim">No entries match &quot;{search}&quot;.</p>
          )}

          {groupedEntries.length > 0 && (
            <div className="mt-3 space-y-2">
              {groupedEntries.map((g) => {
                const isOpen = search.trim() ? true : !!openCategories[g.category]
                return (
                  <div key={g.category} className="overflow-hidden rounded-lg border border-deck-border">
                    <button
                      type="button"
                      onClick={() => toggleCategory(g.category)}
                      className="flex w-full items-center justify-between bg-deck-surface px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-medium text-deck-text">
                        {g.category} ({g.items.length})
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-deck-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="overflow-x-auto border-t border-deck-border">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                              <th className="px-3 py-2 font-medium">Title</th>
                              <th className="px-3 py-2 font-medium">Country</th>
                              <th className="px-3 py-2 font-medium">Source</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((e) => (
                              <Fragment key={e.id}>
                                <tr
                                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                                  className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                                >
                                  <td className="px-3 py-2 font-medium text-deck-text">{e.title}</td>
                                  <td className="px-3 py-2 text-xs text-deck-dim">{e.country || 'All'}</td>
                                  <td className="px-3 py-2 text-xs text-deck-dim">
                                    {e.source === 'project' ? `Project${e.company_name ? ` · ${e.company_name}` : ''}` : 'Manual'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`text-xs font-medium ${e.active ? 'text-emerald-700' : 'text-deck-dim'}`}>
                                      {e.active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                                {expandedId === e.id && (
                                  <tr className="border-b border-deck-border bg-deck-raised last:border-b-0">
                                    <td colSpan={4} className="px-3 py-3">
                                      {e.source === 'project' && (
                                        <p className="text-xs text-deck-mute">
                                          From a confirmed project defect
                                          {e.company_name ? ` · ${e.company_name}` : ''}
                                          {e.source_defect_id && (
                                            <>
                                              {' · '}
                                              <Link href={`/dashboard/defects/${e.source_defect_id}`} className="text-deck-accent underline">
                                                View original defect
                                              </Link>
                                            </>
                                          )}
                                        </p>
                                      )}
                                      {e.applicable_standards && (
                                        <p className="text-xs text-deck-mute">Standard: {e.applicable_standards}</p>
                                      )}
                                      {e.photo_url && (
                                        <img
                                          src={e.photo_url}
                                          alt={`Reference for ${e.title}`}
                                          className="mt-2 w-full rounded-md border border-deck-border"
                                        />
                                      )}
                                      <p className="mt-2 text-xs text-deck-body">
                                        <strong>Wrong:</strong> {e.defect_description}
                                      </p>
                                      {e.correct_reference && (
                                        <p className="mt-1 text-xs text-deck-body">
                                          <strong>Correct:</strong> {e.correct_reference}
                                        </p>
                                      )}
                                      <div className="mt-2 flex gap-3">
                                        <button
                                          onClick={() => handleToggleActive(e.id, e.active)}
                                          className="text-xs font-medium text-deck-accent underline"
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
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
