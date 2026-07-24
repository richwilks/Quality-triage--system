'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Session = {
  id: string
  project_id: string
  drawing_id: string | null
  location_text: string | null
  pin_x: number | null
  pin_y: number | null
  started_at: string
  projects: { name: string } | { name: string }[] | null
}

export default function ActiveInspectionPage() {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('inspection_sessions')
      .select('id, project_id, drawing_id, location_text, pin_x, pin_y, started_at, projects(name)')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setSession(data as unknown as Session)
    setLoading(false)
  }

  function getProjectName(s: Session) {
    if (!s.projects) return ''
    return Array.isArray(s.projects) ? s.projects[0]?.name : s.projects.name
  }

  async function handleEnd() {
    if (!session) return
    setEnding(true)
    await supabase
      .from('inspection_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', session.id)
    setEnding(false)
    setSession(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="text-xl font-semibold text-slate-900">No active inspection</h1>
          <p className="mt-2 text-sm text-slate-500">Start one from a project's drawing.</p>
          <Link
            href="/dashboard/drawings"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to drawings
          </Link>
        </div>
      </div>
    )
  }

  const query = new URLSearchParams({
    projectId: session.project_id,
    ...(session.drawing_id ? { drawingId: session.drawing_id } : {}),
    ...(session.pin_x !== null ? { pinX: String(session.pin_x) } : {}),
    ...(session.pin_y !== null ? { pinY: String(session.pin_y) } : {}),
    location: session.location_text || '',
  })

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Active Inspection</h1>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">{getProjectName(session)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {session.location_text || 'Location not set'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Started {new Date(session.started_at).toLocaleString('en-GB')}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <Link
            href={`/dashboard/new-defect?${query.toString()}`}
            className="block w-full rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Raise defect at this location
          </Link>
          {session.drawing_id && (
            <Link
              href={`/dashboard/drawings/${session.drawing_id}`}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700"
            >
              Update location
            </Link>
          )}
          <button
            onClick={handleEnd}
            disabled={ending}
            className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
          >
            {ending ? 'Ending...' : 'End inspection'}
          </button>
        </div>
      </div>
    </div>
  )
}
