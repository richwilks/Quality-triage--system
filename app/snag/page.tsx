'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FileDropZone from '@/components/FileDropZone'

type Snag = {
  id: string
  description: string
  location: string | null
  photo_url: string | null
  created_at: string
}

export default function SnagListPage() {
  const supabase = createClient()

  const [snags, setSnags] = useState<Snag[]>([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSnags()
  }, [])

  async function loadSnags() {
    setLoading(true)
    const { data } = await supabase.from('snags').select('*').order('created_at', { ascending: false })
    setSnags(data || [])
    setLoading(false)
  }

  async function addSnag(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      let photoUrl: string | null = null
      if (photo) {
        const path = `${user.id}/${Date.now()}-${photo.name}`
        const { error: uploadError } = await supabase.storage.from('snag-photos').upload(path, photo)
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`)
        const {
          data: { publicUrl },
        } = supabase.storage.from('snag-photos').getPublicUrl(path)
        photoUrl = publicUrl
      }

      const { error: insertError } = await supabase.from('snags').insert({
        user_id: user.id,
        description: description.trim(),
        location: location.trim() || null,
        photo_url: photoUrl,
      })
      if (insertError) throw new Error(insertError.message)

      setDescription('')
      setLocation('')
      setPhoto(null)
      await loadSnags()
    } catch (err: any) {
      setError(err?.message || 'Could not save this snag.')
    } finally {
      setSaving(false)
    }
  }

  async function removeSnag(id: string) {
    await supabase.from('snags').delete().eq('id', id)
    setSnags((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-ink">Your snags</h1>
      <p className="mt-1 text-sm text-slate-500">
        Anything you're not happy with is a snag - you don't need to know the cause. Just describe what's wrong and
        where, in your own words.
      </p>

      <form onSubmit={addSnag} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">What's the problem?</label>
          <textarea
            spellCheck="true"
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. There's a gap under the skirting board in the living room and it looks uneven"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Where is it? (optional)</label>
          <input
            spellCheck="true"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Living room, near the window"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Photo (optional)</label>
          <FileDropZone
            onFiles={(files) => setPhoto(files[0])}
            accept="image/*"
            className="mt-1 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-4 text-center"
            dragActiveClassName="border-brand-primary bg-brand-bg"
          >
            {photo ? (
              <p className="text-sm font-medium text-slate-700">{photo.name}</p>
            ) : (
              <p className="text-sm text-slate-400">Drop a photo here, or click to choose one</p>
            )}
          </FileDropZone>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !description.trim()}
          className="mt-4 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add snag'}
        </button>
      </form>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-ink">
            {loading ? 'Loading...' : `${snags.length} snag${snags.length === 1 ? '' : 's'} logged`}
          </h2>
          {snags.length > 0 && (
            <Link
              href="/snag/report"
              className="rounded-md bg-brand-ink px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Generate report
            </Link>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {snags.map((snag) => (
            <div key={snag.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {snag.location && (
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-primary">{snag.location}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-700">{snag.description}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(snag.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSnag(snag.id)}
                  className="whitespace-nowrap text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              {snag.photo_url && (
                <img src={snag.photo_url} alt="" className="mt-3 max-h-48 rounded-md object-cover" />
              )}
            </div>
          ))}
          {!loading && snags.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No snags logged yet. Add your first one above.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
