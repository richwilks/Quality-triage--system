'use client'

import { useEffect, useState } from 'react'
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
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('standards_library')
      .select('id, code, title, document_url, extracted_text, category')
      .order('code', { ascending: true })
    setStandards(data || [])
    setLoading(false)
  }

  async function handleUpload() {
    if (!file || !code) return
    setUploading(true)

    const path = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('standards-library').upload(path, file)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('standards-library').getPublicUrl(path)
      const { data: { user } } = await supabase.auth.getUser()

      const { data: inserted } = await supabase
        .from('standards_library')
        .insert({ code, title: title || null, document_url: publicUrl, category, created_by: user?.id })
        .select()
        .single()

      setCode('')
      setTitle('')
      setFile(null)
      setUploading(false)

      if (inserted) {
        setExtracting(true)
        await fetch('/api/extract-standard-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ standardId: inserted.id }),
        })
        setExtracting(false)
      }
      load()
    } else {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: standards.filter((s) => (s.category || 'General') === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Standards Library" />
        <p className="mt-1 text-sm text-slate-500">
          Upload standards your organisation holds a licensed copy of. Each is processed once, then reused instantly for every relevant analysis.
        </p>

        <div className="mt-6 space-y-5">
          {grouped.length === 0 && (
            <p className="text-sm text-slate-500">No standards uploaded yet.</p>
          )}
          {grouped.map((g) => (
            <div key={g.category}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.category}
              </h2>
              <div className="mt-2 space-y-2">
                {g.items.map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">{s.code}</p>
                    {s.title && <p className="text-xs text-slate-500">{s.title}</p>}
                    <p className="mt-1 text-xs">
                      {s.extracted_text ? (
                        <span className="text-green-700">Ready for analysis</span>
                      ) : (
                        <span className="text-amber-600">Processing...</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Add a standard</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. BS 8204-2"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 w-full text-sm"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || extracting || !file || !code}
            className="mt-3 w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : extracting ? 'Processing document...' : 'Add to library'}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Only upload standards your organisation is properly licensed to hold - these are copyrighted documents.
          </p>
        </div>
      </div>
    </div>
  )
}