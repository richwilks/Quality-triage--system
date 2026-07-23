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
}

export default function StandardsLibraryPage() {
  const supabase = createClient()
  const [standards, setStandards] = useState<StandardDoc[]>([])
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
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
      .select('id, code, title, document_url, extracted_text')
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
        .insert({ code, title: title || null, document_url: publicUrl, created_by: user?.id })
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Standards Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload standards SPHL holds a licensed copy of. Each is processed once, then reused instantly for every relevant analysis.
        </p>

        <div className="mt-6 space-y-2">
          {standards.map((s) => (
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
          {standards.length === 0 && (
            <p className="text-sm text-slate-500">No standards uploaded yet.</p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Add a standard</p>
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
            className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : extracting ? 'Processing document...' : 'Add to library'}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Only upload standards SPHL is properly licensed to hold - these are copyrighted BSI documents.
          </p>
        </div>
      </div>
    </div>
  )
}
