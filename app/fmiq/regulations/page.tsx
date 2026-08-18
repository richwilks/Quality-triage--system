'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type RegulationDoc = {
  id: string
  code: string
  title: string | null
  jurisdiction: string | null
  category: string | null
  document_url: string | null
  extracted_text: string | null
}

const CATEGORIES = [
  'Housing & Habitability',
  'Fire Safety',
  'Health & Safety',
  'Energy Performance',
  'Electrical & Gas Safety',
  'Accessibility',
  'General',
]

export default function RegulationsLibraryPage() {
  const supabase = createClient()
  const [regulations, setRegulations] = useState<RegulationDoc[]>([])
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [category, setCategory] = useState(CATEGORIES[CATEGORIES.length - 1])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

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
      .from('fmiq_regulations_library')
      .select('id, code, title, jurisdiction, category, document_url, extracted_text')
      .order('code', { ascending: true })
    setRegulations(data || [])
    setLoading(false)
  }

  async function handleRetry(id: string) {
    setError(null)
    try {
      const res = await fetch('/api/fmiq/extract-regulation-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regulationId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(`Retry failed: ${body.error || res.status}.`)
      }
    } catch (err: any) {
      setError(`Retry failed: ${err?.message || 'network error'}.`)
    } finally {
      load()
    }
  }

  async function handleUpload() {
    if (!file || !code.trim()) {
      setError('Give it a code/reference and choose a file.')
      return
    }
    setUploading(true)
    setError(null)
    setStatus('Uploading...')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    try {
      const path = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('fmiq-regulations-library').upload(path, file)
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        setStatus(null)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('fmiq-regulations-library').getPublicUrl(path)

      const { data: inserted, error: insertError } = await supabase
        .from('fmiq_regulations_library')
        .insert({
          code: code.trim(),
          title: title.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          category,
          document_url: publicUrl,
          created_by: user?.id,
        })
        .select()
        .single()

      if (insertError || !inserted) {
        setError(`Could not save: ${insertError?.message || 'unknown error'}`)
        setUploading(false)
        setStatus(null)
        return
      }

      setStatus('Processing...')
      const res = await fetch('/api/fmiq/extract-regulation-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regulationId: inserted.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(`Processing failed: ${body.error || res.status}`)
      }
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    }

    setCode('')
    setTitle('')
    setJurisdiction('')
    setFile(null)
    setUploading(false)
    setStatus(null)
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return regulations
    return regulations.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.jurisdiction || '').toLowerCase().includes(q)
    )
  }, [regulations, search])

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: filtered.filter((r) => (r.category || 'General') === cat),
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
        <PageHeader title="Regulations Library" />
        <p className="mt-1 text-sm text-deck-dim">
          Upload local property/housing laws and safety regulations. Matched by jurisdiction during inspections.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Add regulation</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code/reference, e.g. HHSRS, or Housing Act 2004 Part 1"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
          <input
            type="text"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Jurisdiction, e.g. UK (blank = applies everywhere)"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
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
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 w-full text-sm text-deck-dim"
          />

          {status && <p className="mt-2 text-xs text-amber-300">{status}</p>}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !code.trim()}
            className="mt-3 w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {uploading ? 'Processing...' : 'Add regulation'}
          </button>
          <p className="mt-2 text-xs text-deck-dim">
            Only upload documents you're licensed to hold - many regulatory texts are copyrighted.
          </p>
        </div>

        <div className="mt-6">
          {regulations.length === 0 ? (
            <p className="text-sm text-deck-dim">No regulations uploaded yet.</p>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, title, or jurisdiction..."
                className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
              />
              <div className="mt-2 space-y-2">
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
                          {g.items.map((r) => (
                            <div key={r.id} className="rounded-lg border border-deck-border bg-deck-raised p-3">
                              <p className="text-sm font-semibold text-deck-text">{r.code}</p>
                              {r.title && <p className="text-xs text-deck-dim">{r.title}</p>}
                              {r.jurisdiction && <p className="text-xs text-deck-mute">{r.jurisdiction}</p>}
                              <p className="mt-1 text-xs">
                                {r.extracted_text ? (
                                  <span className="text-emerald-400">Ready for analysis</span>
                                ) : (
                                  <span className="text-amber-300">
                                    Processing...{' '}
                                    <button onClick={() => handleRetry(r.id)} className="ml-1 underline text-fmiq-accent">
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
