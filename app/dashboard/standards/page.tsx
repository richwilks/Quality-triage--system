'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type StandardDoc = {
  id: string
  code: string
  title: string | null
  document_url: string | null
  extracted_text: string | null
  category: string | null
}

type UploadProgress = { fileName: string; status: 'uploading' | 'processing' | 'done' | 'error'; error?: string }

const CATEGORIES = [
  'Concrete & Masonry',
  'Structural Steel',
  'Fire Protection & Penetrations',
  'Building Regulations & Codes',
  'Mechanical & Electrical',
  'Cladding & Envelope',
  'General',
]

export default function StandardsLibraryPage() {
  const supabase = createClient()
  const [standards, setStandards] = useState<StandardDoc[]>([])
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[CATEGORIES.length - 1])
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<UploadProgress[]>([])

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  async function load() {
    const { data } = await supabase
      .from('standards_library')
      .select('id, code, title, document_url, extracted_text, category')
      .order('code', { ascending: true })
    setStandards(data || [])
    setLoading(false)
  }

  async function handleRetry(standardId: string) {
    setError(null)
    try {
      const res = await fetch('/api/extract-standard-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standardId }),
      })
      if (!res.ok) {
        let detail = `status ${res.status}`
        try {
          const body = await res.json()
          detail = body.error || detail
        } catch {}
        setError(`Retry failed: ${detail}.`)
      }
    } catch (err: any) {
      setError(`Retry failed: ${err?.message || 'network error'}.`)
    } finally {
      load()
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
  }

  function removeSelectedFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    setProgress(files.map((f) => ({ fileName: f.name, status: 'uploading' })))

    const singleFileMode = files.length === 1
    if (singleFileMode && !code) {
      setError('Please enter a code for this standard.')
      setUploading(false)
      setProgress([])
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // In multi-file mode, derive a code from the filename (without extension) since one code field can't apply to many files
      const codeForThisFile = singleFileMode ? code : file.name.replace(/\.[^/.]+$/, '')
      const titleForThisFile = singleFileMode ? title : null

      try {
        const path = `${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('standards-library').upload(path, file)

        if (uploadError) {
          setProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: uploadError.message } : p))
          )
          continue
        }

        const { data: { publicUrl } } = supabase.storage.from('standards-library').getPublicUrl(path)

        const { data: inserted, error: insertError } = await supabase
          .from('standards_library')
          .insert({
            code: codeForThisFile,
            title: titleForThisFile,
            document_url: publicUrl,
            category,
            created_by: user?.id,
          })
          .select()
          .single()

        if (insertError || !inserted) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error', error: insertError?.message || 'unknown error' } : p
            )
          )
          continue
        }

        setProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'processing' } : p)))

        try {
          const res = await fetch('/api/extract-standard-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ standardId: inserted.id }),
          })
          if (!res.ok) {
            let detail = `status ${res.status}`
            try {
              const body = await res.json()
              detail = body.error || detail
            } catch {}
            setProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: detail } : p))
            )
          } else {
            setProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'done' } : p)))
          }
        } catch (err: any) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error', error: err?.message || 'network error' } : p
            )
          )
        }
      } catch (err: any) {
        setProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: err?.message || 'unexpected error' } : p))
        )
      }
    }

    setCode('')
    setTitle('')
    setFiles([])
    setUploading(false)
    load()
  }

  const filteredStandards = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return standards
    return standards.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
    )
  }, [standards, search])

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: filteredStandards.filter((s) => (s.category || 'General') === cat),
  })).filter((g) => g.items.length > 0)

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Standards Library" />
        <p className="mt-1 text-sm text-deck-dim">
          Upload standards your organisation holds a licensed copy of. Each is processed once, then reused instantly for every relevant analysis.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Add standard(s)</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code, e.g. BS 8204-2 (only used for a single file)"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional, single file only)"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileSelect}
            className="mt-2 w-full text-sm text-deck-dim"
          />

          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-deck-raised px-2 py-1 text-xs text-deck-body">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => removeSelectedFile(i)} className="ml-2 text-red-400">✕</button>
                </div>
              ))}
              {files.length > 1 && (
                <p className="text-[11px] text-deck-dim">
                  Multiple files selected - each will use its filename as the code. You can rename them individually afterwards if needed.
                </p>
              )}
            </div>
          )}

          {progress.length > 0 && (
            <div className="mt-3 space-y-1">
              {progress.map((p, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-deck-body">{p.fileName}</span>{' '}
                  {p.status === 'uploading' && <span className="text-deck-dim">Uploading...</span>}
                  {p.status === 'processing' && <span className="text-amber-300">Processing...</span>}
                  {p.status === 'done' && <span className="text-emerald-400">Ready</span>}
                  {p.status === 'error' && <span className="text-red-400">Failed: {p.error}</span>}
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || (files.length === 1 && !code)}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {uploading ? `Processing ${files.length} file(s)...` : `Add ${files.length || ''} standard${files.length === 1 ? '' : 's'}`}
          </button>
          <p className="mt-2 text-xs text-deck-dim">
            Only upload standards your organisation is properly licensed to hold - these are copyrighted documents.
          </p>
        </div>

        <div className="mt-6">
          {standards.length === 0 ? (
            <p className="text-sm text-deck-dim">No standards uploaded yet.</p>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, title, or category..."
                className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
              />

              <div className="mt-2 space-y-2">
                {grouped.length === 0 && (
                  <p className="text-sm text-deck-dim">No standards match &ldquo;{search}&rdquo;.</p>
                )}
                {grouped.map((g) => {
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
                        <div className="space-y-2 border-t border-deck-border bg-deck-surface p-3">
                          {g.items.map((s) => (
                            <div key={s.id} className="rounded-lg border border-deck-border bg-deck-raised p-3">
                              <p className="text-sm font-semibold text-deck-text">{s.code}</p>
                              {s.title && <p className="text-xs text-deck-dim">{s.title}</p>}
                              <p className="mt-1 text-xs">
                                {s.extracted_text ? (
                                  <span className="text-emerald-400">Ready for analysis</span>
                                ) : (
                                  <span className="text-amber-300">
                                    Processing...{' '}
                                    <button
                                      onClick={() => handleRetry(s.id)}
                                      className="ml-1 underline text-deck-accent"
                                    >
                                      Retry
                                    </button>
                                  </span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
