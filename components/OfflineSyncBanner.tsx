'use client'

import { useOfflineSync } from './OfflineSyncContext'

export default function OfflineSyncBanner() {
  const { isOnline, pendingCount, syncing, lastSyncError } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline - ${pendingCount} defect${pendingCount === 1 ? '' : 's'} will sync when you're back online`
      : "Offline - manual defect entries will be saved on this device and synced when you're back online"
    : syncing
      ? `Syncing ${pendingCount} offline defect${pendingCount === 1 ? '' : 's'}...`
      : `${pendingCount} offline defect${pendingCount === 1 ? '' : 's'} waiting to sync`

  return (
    <div
      className={`sticky top-0 z-40 flex items-center justify-between gap-2 border-b px-4 py-1.5 text-xs font-medium print:hidden ${
        !isOnline ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-deck-border bg-deck-raised text-deck-body'
      }`}
    >
      <span className="truncate">{label}</span>
      {isOnline && lastSyncError && <span className="shrink-0 text-red-600">Sync error - will retry</span>}
    </div>
  )
}
