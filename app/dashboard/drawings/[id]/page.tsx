'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Drawing = { id: string; name: string | null; image_url: string | null; project_id: string }
type Room = { id: string; name: string; pin_x: number; pin_y: number }

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
  const [roomName, setRoomName] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)

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
      .select('id, name, pin_x, pin_y')
      .eq('drawing_id', drawingId)
    setRooms(roomData || [])

    setLoading(false)
  }

  function findNearestRoom(x: number, y: number): Room | null {
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

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPin({ x, y })
    setNearestRoom(findNearestRoom(x, y))
    setRoomName('')
  }

  async function cropAndDetectLabel() {
    if (!pin || !imgRef.current) return
    setDetecting(true)
    try {
      const img = imgRef.current
      const canvas = document.createElement('canvas')
      const cropSize = 0.18
      const naturalW = img.naturalWidth
      const naturalH = img.naturalHeight

      const cropW = naturalW * cropSize
      const cropH = naturalH * cropSize
      const cx = (pin.x / 100) * naturalW - cropW / 2
      const cy = (pin.y / 100) * naturalH - cropH / 2

      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no context')
      ctx.drawImage(img, cx, cy, cropW, cropH, 0, 0, cropW, cropH)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const base64 = dataUrl.split(',')[1]

      const res = await fetch('/api/detect-room-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      const result = await res.json()
      if (result.label) {
        setRoomName(result.label)
      } else {
        setRoomName('')
        alert('No readable label found near that point - enter the room name manually.')
      }
    } catch {
      alert('Could not read a label there - enter the room name manually.')
    } finally {
      setDetecting(false)
    }
  }

  async function handleSaveRoom() {
    if (!pin || !roomName.trim()) return
    setSavingRoom(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase.from('rooms').insert({
      drawing_id: drawingId,
      name: roomName.trim(),
      pin_x: pin.x,
      pin_y: pin.y,
      created_by: user?.id,
    })

    setRoomName('')
    setMarkingMode(false)
    setPin(null)
    setSavingRoom(false)
    load()
  }

  function buildLocationText(): string {
    if (nearestRoom) return nearestRoom.name
    if (!pin) return ''
    return `Pinned on ${drawing?.name || 'drawing'} (${Math.round(pin.x)}%, ${Math.round(pin.y)}%)`
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">{drawing.name}</h1>
          <button
            onClick={() => {
              setMarkingMode((m) => !m)
              setPin(null)
              setRoomName('')
            }}
            className="text-xs font-medium text-slate-900 underline"
          >
            {markingMode ? 'Cancel marking' : 'Mark rooms'}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {markingMode
            ? 'Tap the drawing where a room is, then name it or try AI detect.'
            : 'Tap the drawing to drop a pin at your location.'}
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

          {rooms.map((r) => (
            <div
              key={r.id}
              style={{ position: 'absolute', left: `${r.pin_x}%`, top: `${r.pin_y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
                {r.name}
              </div>
              <div className="mx-auto h-2 w-2 rounded-full bg-slate-900" />
            </div>
          ))}

          {pin && (
            <div
              style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow" />
            </div>
          )}
        </div>

        {markingMode && pin && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <label className="block text-sm font-medium text-slate-700">Room name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Bathroom 214"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={cropAndDetectLabel}
                disabled={detecting}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                {detecting ? 'Reading...' : 'AI: read label here'}
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={savingRoom || !roomName.trim()}
                className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingRoom ? 'Saving...' : 'Save room'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              AI reads printed text on the drawing near your pin - always double check it before saving.
            </p>
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
