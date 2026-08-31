'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  QueuedDefect,
  countQueuedDefects,
  getQueuedDefects,
  queueOfflineDefect as queueOfflineDefectRecord,
  removeQueuedDefect,
} from '@/lib/offlineDefects'
import { imageToBase64 } from '@/lib/imageToBase64'

// Retries the queue on this interval even without a fresh 'online' event -
// browsers don't always fire it reliably (e.g. a flaky connection that
// never fully drops), so this is the backstop.
const RETRY_INTERVAL_MS = 30000

type OfflineSyncContextValue = {
  isOnline: boolean
  pendingCount: number
  syncing: boolean
  lastSyncError: string | null
  queueOfflineDefect: (entry: Omit<QueuedDefect, 'id' | 'queuedAt'>) => Promise<void>
  syncNow: () => Promise<void>
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null)

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext)
  if (!ctx) throw new Error('useOfflineSync must be used within OfflineSyncProvider')
  return ctx
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const syncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await countQueuedDefects())
    } catch {
      // IndexedDB unavailable (e.g. private browsing) - nothing queued, nothing to count.
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    setLastSyncError(null)

    try {
      const queued = await getQueuedDefects()
      for (const entry of queued) {
        try {
          const path = `${entry.projectId}/${Date.now()}-${entry.photoName}`
          const { error: uploadError } = await supabase.storage
            .from('defect-photos')
            .upload(path, entry.photoBlob, { contentType: entry.photoType })
          if (uploadError) throw uploadError

          const {
            data: { publicUrl },
          } = supabase.storage.from('defect-photos').getPublicUrl(path)

          // Best-effort AI cross-check now that we're back online: analyzes
          // the same photo through the normal pipeline and uses it to fill
          // in whatever the inspector left blank (element type, standard
          // reference), and gives the review queue a genuine AI baseline to
          // diff their edits against - same as any AI-detected defect. It
          // never overwrites the inspector's own title, description, or
          // snag/NCR classification; if it fails or times out, the defect
          // still syncs with exactly what the inspector entered.
          let aiDescription = entry.aiDescription
          let aiConfidence = entry.aiConfidence
          let standardReference = entry.standardReference
          let elementType = entry.elementType
          try {
            const imageBase64 = await imageToBase64(entry.photoBlob)
            const aiRes = await fetch('/api/analyze-defect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64,
                mimeType: entry.photoType || 'image/jpeg',
                projectId: entry.projectId,
                location: entry.location,
                finishGrade: entry.finishGrade,
                orientationHint: null,
                source: 'photo',
              }),
            })
            if (aiRes.ok) {
              const aiResult = await aiRes.json()
              const match = aiResult?.defects?.[0]
              if (match) {
                if (match.description) aiDescription = match.description
                if (typeof match.confidence === 'number') aiConfidence = match.confidence
                if (!standardReference && match.standard_reference) standardReference = match.standard_reference
                if (!elementType && match.element_type) elementType = match.element_type
              }
            }
          } catch {
            // AI cross-check is enrichment, not a requirement.
          }

          const { error: insertError } = await supabase.from('defects').insert({
            project_id: entry.projectId,
            title: entry.title,
            location: entry.location || null,
            finish_grade: entry.finishGrade || null,
            drawing_id: entry.drawingId,
            pin_x: entry.pinX,
            pin_y: entry.pinY,
            photo_url: publicUrl,
            ai_description: aiDescription,
            ai_confidence: aiConfidence,
            standard_reference: standardReference,
            description: entry.description,
            bounding_box: entry.box,
            requires_measurement: entry.requiresMeasurement,
            classification: entry.classification,
            element_type: elementType || null,
            measured_gap_mm: entry.measuredGapMm,
            tested_detail_reference: entry.testedDetailReference,
            manufacturer_system: entry.manufacturerSystem,
            assigned_partner_id: entry.assignedPartnerId,
            assigned_company_name: entry.assignedCompanyName,
            target_close_date: entry.targetCloseDate,
            status: 'draft',
            created_by: entry.createdBy,
            inspection_id: entry.inspectionId,
            photo_lat: entry.photoLat,
            photo_lng: entry.photoLng,
            photo_accuracy_m: entry.photoAccuracyM,
            photo_level_label: entry.photoLevelLabel,
          })
          if (insertError) throw insertError

          await removeQueuedDefect(entry.id)
        } catch (err: any) {
          // Stop at the first failure and retry from here next time, rather
          // than hammering through a failing queue out of order.
          setLastSyncError(err?.message || 'Sync failed')
          break
        }
      }
    } finally {
      await refreshPendingCount()
      syncingRef.current = false
      setSyncing(false)
    }
  }, [supabase, refreshPendingCount])

  useEffect(() => {
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    refreshPendingCount()

    function handleOnline() {
      setIsOnline(true)
      syncNow()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Also try on mount, in case there's a leftover queue from a previous session.
      syncNow()
    }

    const retryId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) syncNow()
    }, RETRY_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(retryId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queueOfflineDefect = useCallback(
    async (entry: Omit<QueuedDefect, 'id' | 'queuedAt'>) => {
      await queueOfflineDefectRecord(entry)
      await refreshPendingCount()
    },
    [refreshPendingCount]
  )

  return (
    <OfflineSyncContext.Provider
      value={{ isOnline, pendingCount, syncing, lastSyncError, queueOfflineDefect, syncNow }}
    >
      {children}
    </OfflineSyncContext.Provider>
  )
}
