'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { haversineMeters } from '@/lib/geo'

// A GPS point is only written to the breadcrumb trail once it's moved this
// far, or this long has passed, since the last logged point - watchPosition
// can fire every second or two, and logging every single reading would
// flood the table without adding any useful resolution to the path.
const MIN_LOG_DISTANCE_M = 3
const MIN_LOG_INTERVAL_MS = 8000
// A cached reading this fresh is good enough to tag a photo with - no need
// to wait on a new GPS fix just to save a defect.
const FRESH_POSITION_MAX_AGE_MS = 15000
const GET_POSITION_TIMEOUT_MS = 8000

export type LastPosition = {
  lat: number
  lng: number
  accuracyM: number | null
  altitudeM: number | null
  altitudeAccuracyM: number | null
  capturedAt: number
}

type ActiveInspection = {
  id: string
  projectId: string
  projectName: string
  levelLabel: string
  startedAt: string
  pointCount: number
}

type ActiveInspectionContextValue = {
  activeInspection: ActiveInspection | null
  lastPosition: LastPosition | null
  geoError: string | null
  loading: boolean
  startInspection: (projectId: string, projectName: string, levelLabel: string) => Promise<void>
  endInspection: () => Promise<void>
  setLevel: (levelLabel: string) => Promise<void>
  getCurrentPositionForPhoto: () => Promise<LastPosition | null>
}

const ActiveInspectionContext = createContext<ActiveInspectionContextValue | null>(null)

export function useActiveInspection() {
  const ctx = useContext(ActiveInspectionContext)
  if (!ctx) throw new Error('useActiveInspection must be used within ActiveInspectionProvider')
  return ctx
}

function positionFromGeolocation(pos: GeolocationPosition): LastPosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyM: pos.coords.accuracy ?? null,
    altitudeM: pos.coords.altitude ?? null,
    altitudeAccuracyM: pos.coords.altitudeAccuracy ?? null,
    capturedAt: Date.now(),
  }
}

export function ActiveInspectionProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [activeInspection, setActiveInspection] = useState<ActiveInspection | null>(null)
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const inspectionIdRef = useRef<string | null>(null)
  const levelLabelRef = useRef<string>('')
  const lastLoggedRef = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    async function loadActive() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('inspection_sessions')
        .select('id, project_id, level_label, started_at, projects(name)')
        .eq('started_by', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        const { count } = await supabase
          .from('inspection_points')
          .select('id', { count: 'exact', head: true })
          .eq('inspection_id', data.id)

        const projectName = Array.isArray(data.projects) ? data.projects[0]?.name : (data.projects as any)?.name
        setActiveInspection({
          id: data.id,
          projectId: data.project_id,
          projectName: projectName || 'Project',
          levelLabel: data.level_label || '',
          startedAt: data.started_at,
          pointCount: count || 0,
        })
      }
      setLoading(false)
    }
    loadActive()
  }, [])

  useEffect(() => {
    inspectionIdRef.current = activeInspection?.id || null
    levelLabelRef.current = activeInspection?.levelLabel || ''
  }, [activeInspection?.id, activeInspection?.levelLabel])

  useEffect(() => {
    if (!activeInspection || typeof navigator === 'undefined' || !navigator.geolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = positionFromGeolocation(pos)
        setLastPosition(point)
        setGeoError(null)

        const last = lastLoggedRef.current
        const movedEnough = !last || haversineMeters(last, point) >= MIN_LOG_DISTANCE_M
        const longEnough = !last || Date.now() - last.at >= MIN_LOG_INTERVAL_MS
        if (!movedEnough && !longEnough) return

        const inspectionId = inspectionIdRef.current
        if (!inspectionId) return

        lastLoggedRef.current = { lat: point.lat, lng: point.lng, at: Date.now() }
        supabase
          .from('inspection_points')
          .insert({
            inspection_id: inspectionId,
            lat: point.lat,
            lng: point.lng,
            accuracy_m: point.accuracyM,
            altitude_m: point.altitudeM,
            altitude_accuracy_m: point.altitudeAccuracyM,
            level_label: levelLabelRef.current || null,
          })
          .then(() => {
            setActiveInspection((prev) => (prev ? { ...prev, pointCount: prev.pointCount + 1 } : prev))
          })
      },
      (err) => {
        setGeoError(err.message || 'Could not get GPS location')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    watchIdRef.current = watchId

    return () => {
      navigator.geolocation.clearWatch(watchId)
      watchIdRef.current = null
    }
  }, [activeInspection?.id])

  const startInspection = useCallback(
    async (projectId: string, projectName: string, levelLabel: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data, error } = await supabase
        .from('inspection_sessions')
        .insert({ project_id: projectId, started_by: user.id, level_label: levelLabel || null })
        .select('id, started_at')
        .single()
      if (error) throw error

      lastLoggedRef.current = null
      setActiveInspection({
        id: data.id,
        projectId,
        projectName,
        levelLabel,
        startedAt: data.started_at,
        pointCount: 0,
      })
    },
    []
  )

  const endInspection = useCallback(async () => {
    if (!activeInspection) return
    await supabase
      .from('inspection_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', activeInspection.id)
    setActiveInspection(null)
    lastLoggedRef.current = null
  }, [activeInspection])

  const setLevel = useCallback(
    async (levelLabel: string) => {
      if (!activeInspection) return
      await supabase.from('inspection_sessions').update({ level_label: levelLabel || null }).eq('id', activeInspection.id)
      setActiveInspection((prev) => (prev ? { ...prev, levelLabel } : prev))
    },
    [activeInspection]
  )

  const getCurrentPositionForPhoto = useCallback(async (): Promise<LastPosition | null> => {
    if (lastPosition && Date.now() - lastPosition.capturedAt <= FRESH_POSITION_MAX_AGE_MS) {
      return lastPosition
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), GET_POSITION_TIMEOUT_MS)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId)
          const point = positionFromGeolocation(pos)
          setLastPosition(point)
          resolve(point)
        },
        () => {
          clearTimeout(timeoutId)
          resolve(null)
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: GET_POSITION_TIMEOUT_MS }
      )
    })
  }, [lastPosition])

  return (
    <ActiveInspectionContext.Provider
      value={{
        activeInspection,
        lastPosition,
        geoError,
        loading,
        startInspection,
        endInspection,
        setLevel,
        getCurrentPositionForPhoto,
      }}
    >
      {children}
    </ActiveInspectionContext.Provider>
  )
}
