'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type EconomicReport = {
  id: string
  title: string
  category: string | null
  region: string | null
  document_url: string | null
  extracted_text: string | null
  summary: string | null
}

const CATEGORIES = [
  { value: 'rental', label: 'Rental property' },
  { value: 'commercial', label: 'Commercial property' },
  { value: 'construction', label: 'Construction' },
  { value: 'general', label: 'General' },
]

export default function EconomicReportsLibraryPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<EconomicReport[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [region, setRegion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_economic_reports')
      .select('id, title, category, region, document_url, extracted_text, summary')
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  async function handleRetry(id: string) {
    setError(null)
    try {
      const res = await fetch('/api/copsefield/extract-economic-report-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
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
    if (!file || !title.trim()) {
      setError('Give it a title and choose a file.')
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
      const { error: uploadError } = await supabase.storage.from('fmiq-economic-reports').upload(path, file)
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        setStatus(null)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('fmiq-economic-reports').getPublicUrl(path)

      const { data: inserted, error: insertError } = await supabase
        .from('copsefield_economic_reports')
        .insert({
          title: title.trim(),
          category,
          region: region.trim() || null,
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
      const res = await fetch('/api/copsefield/extract-economic-report-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: inserted.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(`Processing failed: ${body.error || res.status}`)
      }
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    }

    setTitle('')
    setRegion('')
    setFile(null)
    setUploading(false)
    setStatus(null)
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.region || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
    )
  }, [reports, search])

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Economic Reports" />
        <p className="mt-1 text-sm text-deck-dim">
          Rental, commercial property, and construction market data - reviewed and summarised, then used as reference when
          generating property reports.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm lg:col-span-1">
            <p className="text-sm font-medium text-deck-body">Add report</p>
            <input spellCheck="true"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title, e.g. UK Rental Market Report Q2 2026"
              className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input spellCheck="true"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (optional), e.g. London, or National"
              className="mt-2 w-full rounded-md border border-deck-border bg-deck-raised px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
            />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-2 w-full text-sm text-deck-dim"
            />

            {status && <p className="mt-2 text-xs text-amber-700">{status}</p>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
              className="mt-3 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Add report'}
            </button>
          </div>

          <div className="lg:col-span-2">
            {reports.length === 0 ? (
              <p className="text-sm text-deck-dim">No economic reports uploaded yet.</p>
            ) : (
              <>
                <input spellCheck="true"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, category, or region..."
                  className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
                />
                <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {filtered.map((r) => (
                    <div key={r.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                      <p className="text-sm font-semibold text-deck-text">{r.title}</p>
                      <p className="text-xs text-deck-mute">
                        {[CATEGORIES.find((c) => c.value === r.category)?.label, r.region].filter(Boolean).join(' · ')}
                      </p>
                      {r.extracted_text ? (
                        r.summary ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-deck-body">{r.summary}</p>
                        ) : (
                          <p className="mt-2 text-xs text-deck-dim">Extracted, but no summary yet.</p>
                        )
                      ) : (
                        <p className="mt-1 text-xs">
                          <span className="text-amber-700">
                            Processing...{' '}
                            <button onClick={() => handleRetry(r.id)} className="ml-1 underline text-copsefield-accent">
                              Retry
                            </button>
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
