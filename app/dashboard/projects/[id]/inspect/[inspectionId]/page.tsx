'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'

type InspectionSession = {
  id: string
  project_id: string
  started_at: string
  ended_at: string | null
  level_label: string | null
}

type InspectionPoint = {
  lat: number
  lng: number
  accuracy_m: number | null
  altitude_m: number | null
  level_label: string | null
  recorded_at: string
}

type DefectPin = {
  id: string
  title: string | null
  status: string
  classification: string | null
  ncr_number: string | null
  photo_lat: number
  photo_lng: number
}

const LEVEL_COLORS = ['#2A6F77', '#D97706', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#B91C1C']

const VIEW_W = 600
const VIEW_H = 480
const PADDING = 40

function project(lat: number, lng: number, centerLat: number, centerLng: number) {
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180)
  return {
    x: (lng - centerLng) * metersPerDegLng,
    y: -(lat - centerLat) * metersPerDegLat,
  }
}

export default function InspectionPathPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string
  const inspectionId = params.inspectionId as string

  const [session, setSession] = useState<InspectionSession | null>(null)
  const [points, setPoints] = useState<InspectionPoint[]>([])
  const [defects, setDefects] = useState<DefectPin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [inspectionId])

  async function load() {
    const { data: sessionData } = await supabase
      .from('inspection_sessions')
      .select('id, project_id, started_at, ended_at, level_label')
      .eq('id', inspectionId)
      .single()
    setSession(sessionData)

    const { data: pointData } = await supabase
      .from('inspection_points')
      .select('lat, lng, accuracy_m, altitude_m, level_label, recorded_at')
      .eq('inspection_id', inspectionId)
      .order('recorded_at', { ascending: true })
    setPoints(pointData || [])

    const { data: defectData } = await supabase
      .from('defects')
      .select('id, title, status, classification, ncr_number, photo_lat, photo_lng')
      .eq('inspection_id', inspectionId)
      .not('photo_lat', 'is', null)
      .not('photo_lng', 'is', null)
    setDefects((defectData || []) as DefectPin[])

    setLoading(false)
  }

  const layout = useMemo(() => {
    const allCoords = [
      ...points.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...defects.map((d) => ({ lat: d.photo_lat, lng: d.photo_lng })),
    ]
    if (allCoords.length === 0) return null

    const centerLat = allCoords.reduce((s, c) => s + c.lat, 0) / allCoords.length
    const centerLng = allCoords.reduce((s, c) => s + c.lng, 0) / allCoords.length

    const projectedPoints = points.map((p) => ({ ...p, ...project(p.lat, p.lng, centerLat, centerLng) }))
    const projectedDefects = defects.map((d) => ({ ...d, ...project(d.photo_lat, d.photo_lng, centerLat, centerLng) }))

    const allXY = [...projectedPoints, ...projectedDefects]
    const xs = allXY.map((p) => p.x)
    const ys = allXY.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = Math.max(maxX - minX, 2)
    const spanY = Math.max(maxY - minY, 2)

    const availableW = VIEW_W - PADDING * 2
    const availableH = VIEW_H - PADDING * 2
    const scale = Math.min(availableW / spanX, availableH / spanY)

    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2
    const toSvg = (x: number, y: number) => ({
      x: VIEW_W / 2 + (x - midX) * scale,
      y: VIEW_H / 2 + (y - midY) * scale,
    })

    // Consecutive points sharing a level_label become one colored segment, so
    // a level change (set manually - GPS altitude isn't trustworthy enough
    // to detect it) is visible as a color change along the path.
    const levelColors = new Map<string, string>()
    let colorIdx = 0
    function colorFor(label: string) {
      const key = label || '(no level set)'
      if (!levelColors.has(key)) {
        levelColors.set(key, LEVEL_COLORS[colorIdx % LEVEL_COLORS.length])
        colorIdx++
      }
      return levelColors.get(key)!
    }

    type Segment = { label: string; color: string; svgPoints: { x: number; y: number; accuracyM: number | null }[]; start: string; end: string }
    const segments: Segment[] = []
    projectedPoints.forEach((p) => {
      const label = p.level_label || '(no level set)'
      const svgPt = { ...toSvg(p.x, p.y), accuracyM: p.accuracy_m }
      const last = segments[segments.length - 1]
      if (last && last.label === label) {
        last.svgPoints.push(svgPt)
        last.end = p.recorded_at
      } else {
        segments.push({ label, color: colorFor(label), svgPoints: [svgPt], start: p.recorded_at, end: p.recorded_at })
      }
    })

    const defectMarkers = projectedDefects.map((d) => ({ ...d, ...toSvg(d.x, d.y) }))

    return { segments, defectMarkers, levelColors }
  }, [points, defects])

  if (loading || !session) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Inspection path" />
        <p className="mt-1 text-sm text-deck-dim">
          {new Date(session.started_at).toLocaleString('en-GB')}
          {session.ended_at ? ` - ${new Date(session.ended_at).toLocaleTimeString('en-GB')}` : ' - in progress'}
        </p>
        <Link href={`/dashboard/projects/${projectId}/inspect`} className="mt-1 inline-block text-xs font-medium text-deck-accent underline">
          Back to inspections
        </Link>

        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            This is an approximate route reconstructed from phone GPS, not a survey - accuracy is typically
            10-50m indoors. The faint circle around each point shows its reported accuracy; a bigger circle
            means less certain. Levels are manually set, not GPS-detected.
          </p>
        </div>

        {!layout && (
          <p className="mt-6 text-sm text-deck-dim">No GPS points recorded for this inspection yet.</p>
        )}

        {layout && (
          <>
            <div className="mt-4 overflow-hidden rounded-xl border border-deck-border bg-deck-surface">
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" style={{ background: '#F5F3EE' }}>
                {layout.segments.map((seg, si) => (
                  <g key={si}>
                    {seg.svgPoints.map((p, pi) => {
                      const radius = p.accuracyM ? Math.min(Math.max(p.accuracyM * 0.3, 4), 60) : 4
                      return <circle key={pi} cx={p.x} cy={p.y} r={radius} fill={seg.color} opacity={0.12} />
                    })}
                    {seg.svgPoints.length > 1 && (
                      <polyline
                        points={seg.svgPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {seg.svgPoints.map((p, pi) => (
                      <circle key={pi} cx={p.x} cy={p.y} r={3} fill={seg.color} />
                    ))}
                  </g>
                ))}

                {layout.defectMarkers.map((d) => (
                  <a key={d.id} href={`/dashboard/defects/${d.id}`}>
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={7}
                      fill={d.classification === 'ncr' ? '#DC2626' : '#1E293B'}
                      stroke="white"
                      strokeWidth={2}
                    />
                  </a>
                ))}
              </svg>
            </div>

            <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Levels walked</h2>
              <div className="mt-2 space-y-1">
                {Array.from(layout.levelColors.entries()).map(([label, color]) => {
                  const segsForLevel = layout.segments.filter((s) => s.label === label)
                  const count = segsForLevel.reduce((s, seg) => s + seg.svgPoints.length, 0)
                  return (
                    <div key={label} className="flex items-center gap-2 text-xs text-deck-body">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium">{label}</span>
                      <span className="text-deck-dim">- {count} points</span>
                    </div>
                  )
                })}
              </div>
              {layout.defectMarkers.length > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-deck-dim">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1E293B]" /> Snag photo
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> NCR photo
                  </span>
                </div>
              )}
            </div>

            {defects.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">
                  Photos taken during this inspection
                </h2>
                <div className="mt-3 space-y-2">
                  {defects.map((d) => (
                    <Link
                      key={d.id}
                      href={`/dashboard/defects/${d.id}`}
                      className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
                    >
                      <div>
                        {d.ncr_number && (
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-deck-mute">{d.ncr_number}</p>
                        )}
                        <p className="text-sm font-medium text-deck-text">{d.title || 'Untitled'}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
