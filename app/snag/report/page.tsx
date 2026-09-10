'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Snag = { id: string; description: string; location: string | null }
type Conclusion = { snagId: string; point: string }
type Report = {
  id: string
  created_at: string
  summary: string
  conclusions: Conclusion[]
  snag_count: number
}

export default function SnagReportPage() {
  const supabase = createClient()

  const [snags, setSnags] = useState<Snag[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [homeAddress, setHomeAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const [{ data: snagData }, { data: reportData }, { data: profileData }] = await Promise.all([
      supabase.from('snags').select('id, description, location').order('created_at', { ascending: true }),
      supabase.from('snag_reports').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      user
        ? supabase.from('profiles').select('home_address').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
    ])
    setSnags(snagData || [])
    setReport(reportData || null)
    setHomeAddress(profileData?.home_address || null)
    setLoading(false)
  }

  async function generateReport() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-snag-report', { method: 'POST' })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not generate the report.')
        return
      }
      setReport(result.report)
    } catch (err: any) {
      setError(err?.message || 'Could not generate the report.')
    } finally {
      setGenerating(false)
    }
  }

  function snagLabel(snagId: string) {
    const snag = snags.find((s) => s.id === snagId)
    if (!snag) return null
    return snag.location ? `${snag.location} - ${snag.description}` : snag.description
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  return (
    <div className="print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/snag" className="text-sm font-medium text-brand-primary">
          &larr; Back to your snags
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-brand-ink">Snag report</h1>
      {homeAddress && <p className="mt-1 text-sm font-medium text-slate-700">{homeAddress}</p>}
      <p className="mt-1 text-sm text-slate-500">
        {snags.length} snag{snags.length === 1 ? '' : 's'} logged. This report is a summary of what you've recorded,
        with points to help you raise it with your builder, developer, or warranty provider.
      </p>
      <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-500 print:hidden">
        This is based only on your own descriptions, not a site inspection - it organises and strengthens your case,
        it doesn't replace a professional survey.
      </p>

      {!report && (
        <button
          type="button"
          onClick={generateReport}
          disabled={generating || snags.length === 0}
          className="mt-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 print:hidden"
        >
          {generating ? 'Reviewing your snags...' : 'Generate report'}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {report && (
        <div className="mt-6">
          <div className="flex items-center justify-between print:hidden">
            <p className="text-xs text-slate-400">Generated {new Date(report.created_at).toLocaleString()}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={generateReport}
                disabled={generating}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {generating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.summary}</p>

            <h2 className="mt-6 text-lg font-semibold text-slate-900">Supporting points</h2>
            {report.conclusions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No connecting patterns found across your snags - each looks like an independent, standalone issue.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {report.conclusions.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    {snagLabel(c.snagId) && (
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-primary">
                        {snagLabel(c.snagId)}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-700">{c.point}</p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-6 text-lg font-semibold text-slate-900">All logged snags</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {snags.map((s) => (
                <li key={s.id}>
                  {s.location ? <span className="font-medium">{s.location}: </span> : null}
                  {s.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
