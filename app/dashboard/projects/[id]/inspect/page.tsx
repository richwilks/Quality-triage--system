'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { useActiveInspection } from '@/components/ActiveInspectionContext'

type Project = { id: string; name: string }
type Drawing = { id: string; name: string | null }
type PastInspection = {
  id: string
  started_at: string
  ended_at: string | null
  level_label: string | null
  pointCount: number
}

export default function InspectPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string
  const { activeInspection, geoError, lastPosition, startInspection, endInspection, setLevel } = useActiveInspection()

  const [project, setProject] = useState<Project | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [levelChoice, setLevelChoice] = useState('')
  const [customLevel, setCustomLevel] = useState('')
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [pastInspections, setPastInspections] = useState<PastInspection[]>([])
  const [loading, setLoading] = useState(true)

  const isActiveHere = activeInspection?.projectId === projectId

  useEffect(() => {
    load()
  }, [projectId, activeInspection?.id])

  async function load() {
    const { data: projectData } = await supabase.from('projects').select('id, name').eq('id', projectId).single()
    setProject(projectData)

    const { data: drawingData } = await supabase
      .from('drawings')
      .select('id, name')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    setDrawings(drawingData || [])

    const { data: sessions } = await supabase
      .from('gps_inspection_sessions')
      .select('id, started_at, ended_at, level_label')
      .eq('project_id', projectId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20)

    const withCounts = await Promise.all(
      (sessions || []).map(async (s) => {
        const { count } = await supabase
          .from('gps_inspection_points')
          .select('id', { count: 'exact', head: true })
          .eq('inspection_id', s.id)
        return { ...s, pointCount: count || 0 }
      })
    )
    setPastInspections(withCounts)
    setLoading(false)
  }

  async function handleStart() {
    if (!project) return
    setStarting(true)
    try {
      await startInspection(project.id, project.name, customLevel || levelChoice)
    } finally {
      setStarting(false)
    }
  }

  async function handleEnd() {
    setEnding(true)
    try {
      await endInspection()
      load()
    } finally {
      setEnding(false)
    }
  }

  function formatElapsed(startedAt: string) {
    const ms = Date.now() - new Date(startedAt).getTime()
    const totalMinutes = Math.max(0, Math.floor(ms / 60000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Inspection" />
        <p className="mt-1 text-sm text-deck-dim">{project.name}</p>

        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            GPS is unreliable indoors - typically 10-50m accurate, worse in steel-framed or below-ground
            areas. Treat the path as an approximate route, not a survey. Level/floor is set manually below
            because GPS altitude isn't reliable enough to detect floor changes automatically.
          </p>
        </div>

        {activeInspection && !isActiveHere && (
          <div className="mt-4 rounded-md border border-deck-border bg-deck-raised p-3">
            <p className="text-sm text-deck-body">
              You have an inspection already running on {activeInspection.projectName}.
            </p>
            <Link
              href={`/dashboard/projects/${activeInspection.projectId}/inspect`}
              className="mt-1 inline-block text-xs font-medium text-deck-accent underline"
            >
              Go to that inspection
            </Link>
          </div>
        )}

        {isActiveHere && activeInspection && (
          <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <p className="text-sm font-semibold text-deck-text">Inspection in progress</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-deck-dim">
              <p>Elapsed: <span className="font-medium text-deck-body">{formatElapsed(activeInspection.startedAt)}</span></p>
              <p>Points logged: <span className="font-medium text-deck-body">{activeInspection.pointCount}</span></p>
              <p>
                Current fix:{' '}
                <span className="font-medium text-deck-body">
                  {lastPosition ? `±${Math.round(lastPosition.accuracyM ?? 0)}m` : 'waiting...'}
                </span>
              </p>
              <p>Level: <span className="font-medium text-deck-body">{activeInspection.levelLabel || 'not set'}</span></p>
            </div>
            {geoError && <p className="mt-2 text-xs text-red-600">GPS error: {geoError}</p>}

            <label className="mt-4 block text-sm font-medium text-deck-body">Change level</label>
            <div className="mt-1 flex gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && setLevel(e.target.value)}
                className="flex-1 rounded-md border border-deck-border px-2 py-2 text-sm bg-deck-surface text-deck-text"
              >
                <option value="">Choose from drawings...</option>
                {drawings.map((d) => (
                  <option key={d.id} value={d.name || ''}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customLevel}
                onChange={(e) => setCustomLevel(e.target.value)}
                placeholder="or type a level, e.g. Roof, B1 Car Park"
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
              <button
                onClick={() => {
                  if (customLevel) {
                    setLevel(customLevel)
                    setCustomLevel('')
                  }
                }}
                disabled={!customLevel}
                className="rounded-md border border-deck-border px-3 py-2 text-xs font-medium text-deck-text disabled:opacity-50"
              >
                Set
              </button>
            </div>

            <Link
              href={`/dashboard/new-defect?projectId=${projectId}`}
              className="mt-4 block w-full rounded-md bg-deck-accent px-3 py-2 text-center text-sm font-medium text-deck-bg"
            >
              Take photo / log defect
            </Link>
            <Link
              href={`/dashboard/projects/${projectId}/inspect/${activeInspection.id}`}
              className="mt-2 block w-full rounded-md border border-deck-border px-3 py-2 text-center text-sm font-medium text-deck-body"
            >
              View path so far
            </Link>
            <button
              onClick={handleEnd}
              disabled={ending}
              className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              {ending ? 'Ending...' : 'End inspection'}
            </button>
          </div>
        )}

        {!activeInspection && (
          <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <p className="text-sm font-semibold text-deck-text">Start an inspection</p>
            <p className="mt-1 text-xs text-deck-dim">
              Tracks your path while you walk the site and tags each photo you take with where it was taken.
            </p>

            <label className="mt-3 block text-sm font-medium text-deck-body">Starting level</label>
            <select
              value={levelChoice}
              onChange={(e) => setLevelChoice(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
            >
              <option value="">Choose from drawings...</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.name || ''}>{d.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={customLevel}
              onChange={(e) => setCustomLevel(e.target.value)}
              placeholder="or type a level, e.g. Roof, B1 Car Park"
              className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />

            <button
              onClick={handleStart}
              disabled={starting}
              className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start inspection'}
            </button>
          </div>
        )}

        {pastInspections.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Past inspections</h2>
            <div className="mt-3 space-y-2">
              {pastInspections.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/projects/${projectId}/inspect/${s.id}`}
                  className="block rounded-lg border border-deck-border bg-deck-surface p-3"
                >
                  <p className="text-sm font-medium text-deck-text">
                    {new Date(s.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(s.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="mt-0.5 text-xs text-deck-dim">
                    {s.level_label || 'No level set'} · {s.pointCount} points
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
