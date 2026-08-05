'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Drawing = { id: string; name: string | null; image_url: string | null; project_id: string }
type Point = { x: number; y: number }
type Room = { id: string; name: string; pin_x: number; pin_y: number; boundary: Point[] | null }

function centroid(points: Point[]): Point {
  const n = points.length
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / n, y: sum.y / n }
}

function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export default function DrawingPinPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const drawingId = params.id as string
  const imgRef = useRef<HTMLImageElement>(null)

  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [nearestRoom, setNearestRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)

  const [markingMode, setMarkingMode] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [drawPoints, setDrawPoints] = useState<Point[]>([])
  const [roomName, setRoomName] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectingBoundary, setDetectingBoundary] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [boundaryError, setBoundaryError] = useState<string | null>(null)
  const [deletingRoom, setDeletingRoom] = useState(false)

  useEffect(() => {
    load()
  }, [drawingId])

  async function load() {
    const { data } = await supabase
      .from('drawings')
      .select('id, name, image_url, project_id')
      .eq('id', drawingId)
      .single()
    setDrawing(data)

    const { data: roomData } = await supabase
      .from('rooms')
      .select('id, name, pin_x, pin_y, boundary')
      .eq('drawing_id', drawingId)
    setRooms(roomData || [])

    setLoading(false)
  }

  function findContainingOrNearestRoom(x: number, y: number): Room | null {
    for (const r of rooms) {
      if (r.boundary && r.boundary.length >= 3 && pointInPolygon(x, y, r.boundary)) {
        return r
      }
    }
    let closest: Room | null = null
    let closestDist = Infinity
    for (const r of rooms) {
      const dist = Math.hypot(r.pin_x - x, r.pin_y - y)
      if (dist < closestDist) {
        closestDist = dist
        closest = r
      }
    }
    return closestDist < 4 ? closest : null
  }

  async function runBoundaryDetection(x: number, y: number) {
    if (!imgRef.current || !drawing?.image_url) return
    setDetectingBoundary(true)
    setBoundaryError(null)

    try {
      const img = imgRef.current
      const naturalW = img.naturalWidth
      const naturalH = img.naturalHeight

      const fullX = (x / 100) * naturalW
      const fullY = (y / 100) * naturalH

      const cropFraction = 0.4
      let cropW = naturalW * cropFraction
      let cropH = naturalH * cropFraction
      cropW = Math.min(cropW, naturalW)
      cropH = Math.min(cropH, naturalH)

      let cx = fullX - cropW / 2
      let cy = fullY - cropH / 2
      cx = Math.max(0, Math.min(cx, naturalW - cropW))
      cy = Math.max(0, Math.min(cy, naturalH - cropH))

      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no context')
      ctx.drawImage(img, cx, cy, cropW, cropH, 0, 0, cropW, cropH)

      const markerPxX = fullX - cx
      const markerPxY = fullY - cy
      const markerRadius = cropW * 0.012
      ctx.beginPath()
      ctx.arc(markerPxX, markerPxY, markerRadius, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(220,38,38,0.9)'
      ctx.fill()
      ctx.lineWidth = markerRadius * 0.3
      ctx.strokeStyle = 'white'
      ctx.stroke()

      const markerPctX = (markerPxX / cropW) * 100
      const markerPctY = (markerPxY / cropH) * 100

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const base64 = dataUrl.split(',')[1]

      const res = await fetch('/api/detect-room-boundary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
          clickX: markerPctX,
          clickY: markerPctY,
        }),
      })
      const result = await res.json()

      if (result.boundary && result.boundary.length >= 3) {
        const fullBoundary: Point[] = result.boundary.map((p: Point) => {
          const cropPxX = (p.x / 100) * cropW
          const cropPxY = (p.y / 100) * cropH
          const fullPxX = cx + cropPxX
          const fullPxY = cy + cropPxY
          return {
            x: (fullPxX / naturalW) * 100,
            y: (fullPxY / naturalH) * 100,
          }
        })

        setDrawPoints(fullBoundary)

        const center = centroid(fullBoundary)
        let label = result.label || ''

        try {
          const cropCanvas = document.createElement('canvas')
          const labelCropSize = 0.18
          const labelCropW = naturalW * labelCropSize
          const labelCropH = naturalH * labelCropSize
          const lcx = (center.x / 100) * naturalW - labelCropW / 2
          const lcy = (center.y / 100) * naturalH - labelCropH / 2

          cropCanvas.width = labelCropW
          cropCanvas.height = labelCropH
          const cropCtx = cropCanvas.getContext('2d')
          if (cropCtx) {
            cropCtx.drawImage(img, lcx, lcy, labelCropW, labelCropH, 0, 0, labelCropW, labelCropH)
            const cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9)
            const cropBase64 = cropDataUrl.split(',')[1]

            const labelRes = await fetch('/api/detect-room-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: cropBase64, mimeType: 'image/jpeg' }),
            })
            const labelResult = await labelRes.json()
            if (labelResult.label) {
              label = labelResult.label
            }
          }
        } catch {
          // fall back silently to whatever label the boundary call returned, if any
        }

        setRoomName(label)
      } else {
        setBoundaryError('Could not trace that room automatically - try tapping more centrally, or draw it manually below.')
      }
    } catch {
      setBoundaryError('Detection failed - try tapping more centrally, or draw it manually below.')
    } finally {
      setDetectingBoundary(false)
    }
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (markingMode && manualMode) {
      setDrawPoints((prev) => [...prev, { x, y }])
      return
    }

    if (markingMode && !manualMode) {
      setDrawPoints([])
      setRoomName('')
      runBoundaryDetection(x, y)
      return
    }

    setPin({ x, y })
    setNearestRoom(findContainingOrNearestRoom(x, y))
    setRoomName('')
    setSelectedRoomId(null)
  }

  function handleRoomClick(e: React.MouseEvent, roomId: string) {
    e.stopPropagation()
    if (markingMode) return
    setSelectedRoomId((current) => (current === roomId ? null : roomId))
  }

  function undoLastPoint() {
    setDrawPoints((prev) => prev.slice(0, -1))
  }

  function clearDrawing() {
    setDrawPoints([])
    setRoomName('')
    setBoundaryError(null)
  }

  async function handleSaveRoom() {
    if (drawPoints.length < 3 || !roomName.trim()) return
    setSavingRoom(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const center = centroid(drawPoints)

    await supabase.from('rooms').insert({
      drawing_id: drawingId,
      name: roomName.trim(),
      pin_x: center.x,
      pin_y: center.y,
      boundary: drawPoints,
      created_by: user?.id,
    })

    setRoomName('')
    setDrawPoints([])
    setMarkingMode(false)
    setManualMode(false)
    setSavingRoom(false)
    load()
  }

  async function handleDeleteRoom(roomId: string) {
    setDeletingRoom(true)
    await supabase.from('rooms').delete().eq('id', roomId)
    setSelectedRoomId(null)
    setDeletingRoom(false)
    load()
  }

  function buildLocationText(): string {
    if (nearestRoom) return nearestRoom.name
    return drawing?.name || 'Custom location'
  }

  function handleRaiseDefect() {
    if (!drawing || !pin) return
    const query = new URLSearchParams({
      projectId: drawing.project_id,
      drawingId: drawing.id,
      pinX: pin.x.toFixed(1),
      pinY: pin.y.toFixed(1),
      location: buildLocationText(),
    })
    router.push(`/dashboard/new-defect?${query.toString()}`)
  }

  async function handleStartInspection() {
    if (!drawing || !pin) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('inspection_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('ended_at', null)

    await supabase.from('inspection_sessions').insert({
      project_id: drawing.project_id,
      user_id: user.id,
      drawing_id: drawing.id,
      room_id: nearestRoom?.id || null,
      location_text: buildLocationText(),
      pin_x: pin.x,
      pin_y: pin.y,
    })

    router.push('/dashboard/inspection/active')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!drawing) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Drawing not found.</p>
      </div>
    )
  }

  const drawPointsStr = drawPoints.map((p) => `${p.x}%,${p.y}%`).join(' ')
  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">{drawing.name}</h1>
          <button
            onClick={() => {
              setMarkingMode((m) => !m)
              setManualMode(false)
              setPin(null)
              setDrawPoints([])
              setRoomName('')
              setSelectedRoomId(null)
              setBoundaryError(null)
            }}
            className="text-xs font-medium text-slate-900 underline"
          >
            {markingMode ? 'Cancel marking' : 'Mark rooms'}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {markingMode && !manualMode && 'Tap once inside a room - AI will trace its walls automatically.'}
          {markingMode && manualMode && `Tap each corner of the room in order (${drawPoints.length} point${drawPoints.length === 1 ? '' : 's'} so far). Need at least 3.`}
          {!markingMode && 'Tap the drawing to drop a pin at your location. Tap a highlighted room to see its name and options.'}
        </p>

        <div
          className="relative mt-4 w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-200"
          onClick={handleImageClick}
        >
          {drawing.image_url && (
            <img
              ref={imgRef}
              src={drawing.image_url}
              alt={drawing.name || 'Drawing'}
              className="w-full"
              crossOrigin="anonymous"
            />
          )}

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {rooms.map((r) => {
              if (!r.boundary || r.boundary.length < 3) return null
              const isSelected = selectedRoomId === r.id
              const pointsStr = r.boundary.map((p) => `${p.x},${p.y}`).join(' ')
              return (
                <polygon
                  key={r.id}
                  points={pointsStr}
                  fill={isSelected ? 'rgba(13,148,136,0.35)' : 'rgba(20,184,166,0.2)'}
                  stroke={isSelected ? 'rgba(13,148,136,0.9)' : 'rgba(13,148,136,0.5)'}
                  strokeWidth={0.3}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e: any) => handleRoomClick(e, r.id)}
                />
              )
            })}

            {markingMode && drawPoints.length > 0 && (
              <polygon
                points={drawPointsStr}
                fill="rgba(220,38,38,0.2)"
                stroke="rgba(220,38,38,0.8)"
                strokeWidth={0.3}
              />
            )}
          </svg>

          {markingMode &&
            manualMode &&
            drawPoints.map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="h-2.5 w-2.5 rounded-full border border-white bg-red-600"
              />
            ))}

          {selectedRoom && !markingMode && (
            <div
              style={{
                position: 'absolute',
                left: `${selectedRoom.pin_x}%`,
                top: `${selectedRoom.pin_y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="pointer-events-none whitespace-nowrap rounded bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-white"
            >
              {selectedRoom.name}
            </div>
          )}

          {pin && (
            <div
              style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow" />
            </div>
          )}
        </div>

        {selectedRoom && !markingMode && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">{selectedRoom.name}</p>
            <button
              onClick={() => handleDeleteRoom(selectedRoom.id)}
              disabled={deletingRoom}
              className="text-xs font-medium text-red-600 disabled:opacity-50"
            >
              {deletingRoom ? 'Removing...' : 'Remove this markup'}
            </button>
          </div>
        )}

        {markingMode && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            {detectingBoundary && (
              <p className="text-sm text-slate-500">Tracing room walls...</p>
            )}

            {boundaryError && !detectingBoundary && (
              <p className="text-sm text-amber-600">{boundaryError}</p>
            )}

            {!manualMode && !detectingBoundary && drawPoints.length === 0 && !boundaryError && (
              <button
                onClick={() => setManualMode(true)}
                className="text-xs font-medium text-slate-500 underline"
              >
                Prefer to draw it manually instead?
              </button>
            )}

            {manualMode && (
              <div className="flex gap-2">
                <button
                  onClick={undoLastPoint}
                  disabled={drawPoints.length === 0}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Undo last point
                </button>
                <button
                  onClick={clearDrawing}
                  disabled={drawPoints.length === 0}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}

            {!manualMode && boundaryError && (
              <button
                onClick={() => setManualMode(true)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Draw manually instead
              </button>
            )}

            {drawPoints.length >= 3 && (
              <>
                <label className="mt-4 block text-sm font-medium text-slate-700">Room name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Bathroom 214"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSaveRoom}
                  disabled={savingRoom || !roomName.trim()}
                  className="mt-2 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingRoom ? 'Saving...' : 'Save room'}
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  {manualMode
                    ? 'Check the shape matches the room before saving.'
                    : 'AI traced this from the drawing and read the label if visible - double check both before saving.'}
                </p>
              </>
            )}
          </div>
        )}

        {!markingMode && pin && (
          <div className="mt-4 space-y-2">
            {nearestRoom && (
              <p className="text-sm font-medium text-slate-700">Nearest marked room: {nearestRoom.name}</p>
            )}
            <button
              onClick={handleStartInspection}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Start inspection here
            </button>
            <button
              onClick={handleRaiseDefect}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Raise a one-off defect here
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
