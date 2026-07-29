'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClauseViewer({
  projectId,
  standardReference,
}: {
  projectId: string
  standardReference: string | null
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [snippet, setSnippet] = useState('')
  const [source, setSource] = useState('')
  const [found, setFound] = useState(false)

  if (!standardReference) return null

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      try {
        const res = await fetch('/api/get-clause-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, standardReference }),
        })
        const result = await res.json()
        setFound(!!result.found)
        setSnippet(result.snippet || '')
        setSource(result.source || '')
      } catch {
        setFound(false)
      } finally {
        setLoading(false)
        setLoaded(true)
      }
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs font-medium text-brand-primary underline"
      >
        {open ? 'Hide clause text ▲' : 'View clause text ▼'}
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 p-2">
          {loading && <p className="text-xs text-slate-500">Looking up clause...</p>}
          {!loading && found && (
            <>
              <p className="text-[10px] font-semibold uppercase text-slate-400">{source}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{snippet}</p>
            </>
          )}
          {!loading && !found && (
            <p className="text-xs text-slate-500">
              Couldn't locate this clause in the uploaded documents - check the original document directly.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
