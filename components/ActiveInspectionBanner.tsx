'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useActiveInspection } from './ActiveInspectionContext'

function formatElapsed(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime()
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default function ActiveInspectionBanner() {
  const { activeInspection, lastPosition } = useActiveInspection()
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!activeInspection) return
    const id = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [activeInspection?.id])

  if (!activeInspection) return null

  const accuracy = lastPosition?.accuracyM
  const accuracyLabel = accuracy != null ? `±${Math.round(accuracy)}m` : 'no fix yet'

  return (
    <Link
      href={`/dashboard/projects/${activeInspection.projectId}/inspect`}
      className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-deck-border bg-deck-accent px-4 py-1.5 text-xs font-medium text-deck-bg print:hidden"
    >
      <span className="truncate">
        Inspecting {activeInspection.projectName}
        {activeInspection.levelLabel ? ` · ${activeInspection.levelLabel}` : ''} · {formatElapsed(activeInspection.startedAt)} · {activeInspection.pointCount} pts · {accuracyLabel}
      </span>
      <span className="shrink-0 underline">Manage</span>
    </Link>
  )
}
