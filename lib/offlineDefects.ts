// IndexedDB-backed queue for defects created while offline. Structured-clone
// natively supports Blob/File, so the photo itself is stored alongside the
// rest of the defect fields with no base64 conversion needed.

const DB_NAME = 'inspectiq-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending_defects'

export type QueuedDefect = {
  id: string
  queuedAt: string
  projectId: string
  title: string
  location: string
  finishGrade: string
  drawingId: string | null
  pinX: number | null
  pinY: number | null
  description: string
  aiDescription: string
  aiConfidence: number | null
  standardReference: string
  requiresMeasurement: boolean
  classification: 'snag' | 'ncr'
  elementType: string
  box: { x: number; y: number; width: number; height: number }
  measuredGapMm: number | null
  testedDetailReference: string | null
  manufacturerSystem: string | null
  assignedCompanyName: string | null
  assignedPartnerId: string | null
  targetCloseDate: string | null
  createdBy: string
  inspectionId: string | null
  photoLat: number | null
  photoLng: number | null
  photoAccuracyM: number | null
  photoLevelLabel: string | null
  photoBlob: Blob
  photoName: string
  photoType: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open offline storage'))
  })
}

export async function queueOfflineDefect(entry: Omit<QueuedDefect, 'id' | 'queuedAt'>): Promise<void> {
  const db = await openDB()
  const record: QueuedDefect = {
    ...entry,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Could not queue defect offline'))
  })
  db.close()
}

export async function getQueuedDefects(): Promise<QueuedDefect[]> {
  const db = await openDB()
  const result = await new Promise<QueuedDefect[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as QueuedDefect[])
    request.onerror = () => reject(request.error || new Error('Could not read offline queue'))
  })
  db.close()
  return result.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
}

export async function removeQueuedDefect(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Could not remove queued defect'))
  })
  db.close()
}

export async function countQueuedDefects(): Promise<number> {
  const db = await openDB()
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not count offline queue'))
  })
  db.close()
  return count
}
