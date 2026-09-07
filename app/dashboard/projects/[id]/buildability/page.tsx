'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'
import { imageToBase64 } from '@/lib/imageToBase64'
import { BUILDABILITY_CATEGORY_LABELS, buildabilityItemByKey } from '@/lib/buildabilityChecklist'

type Project = { id: string; name: string }

type Finding = {
  checklistKey: string
  concern: string
  location: string
  confidence: number
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function BuildabilityReviewPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single()
      .then(({ data }) => setProject(data))
  }, [projectId])

  function handleFile(files: File[]) {
    setFile(files[0])
    setFindings(null)
    setDismissed(new Set())
    setError(null)
  }

  async function runReview() {
    if (!file) return
    setAnalyzing(true)
    setError(null)

    try {
      const isPdf = file.type === 'application/pdf'
      const base64 = isPdf ? await fileToBase64(file) : await imageToBase64(file)

      const res = await fetch('/api/analyze-buildability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawingBase64: base64,
          mediaType: isPdf ? 'application/pdf' : 'image/jpeg',
          kind: isPdf ? 'document' : 'image',
          projectId,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Analysis failed.')
        return
      }
      setFindings(result.findings || [])
    } catch (err: any) {
      setError(err?.message || 'Could not run the review.')
    } finally {
      setAnalyzing(false)
    }
  }

  const visibleFindings = (findings || []).filter((_, i) => !dismissed.has(i))

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Buildability Review" />
        <p className="mt-1 text-sm text-deck-dim">
          {project ? `${project.name} — ` : ''}Upload a drawing to check it against a checklist of known buildability
          risk patterns (access, sequencing, interfaces, fixings, site conditions).
        </p>
        <p className="mt-2 rounded-md bg-deck-raised px-3 py-2 text-xs text-deck-dim">
          This flags things worth a second look — it is not a pass/fail check, and not a substitute for a qualified
          reviewer. Every finding needs a person to confirm it's real before it means anything.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <FileDropZone
            onFiles={handleFile}
            accept="image/*,.pdf,application/pdf"
            className="cursor-pointer rounded-lg border-2 border-dashed border-deck-border p-8 text-center"
            dragActiveClassName="border-deck-accent bg-deck-raised"
          >
            {file ? (
              <p className="text-sm font-medium text-deck-text">{file.name}</p>
            ) : (
              <p className="text-sm text-deck-dim">Drop a drawing here, or click to choose a file (image or PDF)</p>
            )}
          </FileDropZone>

          <button
            type="button"
            onClick={runReview}
            disabled={!file || analyzing}
            className="mt-4 rounded-md bg-deck-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {analyzing ? 'Reviewing…' : 'Run buildability review'}
          </button>
          {error && <p className="mt-2 text-sm text-status-rejected">{error}</p>}
        </div>

        {findings !== null && (
          <div className="mt-6">
            {findings.length === 0 ? (
              <div className="rounded-xl border border-deck-border bg-deck-surface p-6 text-sm text-deck-dim">
                No concerns flagged against the checklist for this drawing. That's not the same as "no issues" — it
                only means nothing matched a known risk pattern.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-deck-text">
                  {visibleFindings.length} of {findings.length} concern{findings.length === 1 ? '' : 's'} to review
                </p>
                {findings.map((finding, i) => {
                  if (dismissed.has(i)) return null
                  const item = buildabilityItemByKey(finding.checklistKey)
                  return (
                    <div key={i} className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-deck-accent">
                            {item ? BUILDABILITY_CATEGORY_LABELS[item.category] : 'Buildability'}
                            {item ? ` · ${item.label}` : ''}
                          </p>
                          <p className="mt-1 text-sm text-deck-text">{finding.concern}</p>
                          {finding.location && <p className="mt-1 text-xs text-deck-dim">Location: {finding.location}</p>}
                        </div>
                        <span className="whitespace-nowrap text-xs text-deck-dim">
                          {Math.round(finding.confidence * 100)}% confidence
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                        className="mt-3 rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-body hover:bg-deck-raised"
                      >
                        Dismiss — checked, not a concern
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
