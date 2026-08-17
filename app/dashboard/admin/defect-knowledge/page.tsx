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

  function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
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
        <p className="text-sm text-red-400">You don't have access to this page.</p>
      </div>
    )
  }

  const successCount = importResults?.filter((r) => r.status === 'success').length || 0
  const errorCount = importResults?.filter((r) => r.status === 'error').length || 0

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Defect Knowledge Base" />
        <p className="mt-1 text-sm text-deck-dim">
          Shared defect patterns that apply across all projects, matched automatically by country and standard during photo analysis.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Bulk import from CSV</p>
          <p className="mt-1 text-xs text-deck-dim">
            Columns required: <span className="font-mono">title, element_type, country, applicable_standards, defect_description</span>. Only <span className="font-mono">title</span> and <span className="font-mono">defect_description</span> are required per row - the rest can be left blank.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleCsvSelect}
            className="mt-3 w-full text-sm"
          />

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
                      <p key={i} className="text-xs text-red-400">
                        Row {r.row} ({r.title}): {r.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {entries.length === 0 && (
            <p className="text-sm text-deck-dim">No knowledge base entries yet.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-deck-text">{e.title}</p>
                  <p className="text-xs text-deck-dim">
                    {[e.element_type, e.country, e.applicable_standards].filter(Boolean).join(' · ') || 'General'}
                  </p>
                </div>
                <span className={`text-xs font-medium ${e.active ? 'text-emerald-400' : 'text-deck-dim'}`}>
                  {e.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-2 text-xs text-deck-body"><strong>Wrong:</strong> {e.defect_description}</p>
              {e.correct_reference && (
                <p className="mt-1 text-xs text-deck-body"><strong>Correct:</strong> {e.correct_reference}</p>
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
                  className="text-xs font-medium text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Add a single entry</p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Inpro movement joint - max expansion"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={elementType}
            onChange={(e) => setElementType(e.target.value)}
            placeholder="Element type, e.g. Movement joint"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country, e.g. UK (leave blank to apply to all)"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={applicableStandards}
            onChange={(e) => setApplicableStandards(e.target.value)}
            placeholder="Applicable standard code, e.g. IPC.3087 (optional)"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <textarea
            value={defectDescription}
            onChange={(e) => setDefectDescription(e.target.value)}
            placeholder="What wrong looks like - be specific and visual"
            rows={3}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <textarea
            value={correctReference}
            onChange={(e) => setCorrectReference(e.target.value)}
            placeholder="What correct looks like (optional, but recommended)"
            rows={3}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
          <select
            value={severityDefault}
            onChange={(e) => setSeverityDefault(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          >
            <option value="ncr">NCR</option>
            <option value="snag">Snag</option>
          </select>

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={saving || !title || !defectDescription}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
