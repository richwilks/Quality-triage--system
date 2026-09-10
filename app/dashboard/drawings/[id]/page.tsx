'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import DistoConnect from '@/components/DistoConnect'
import { cleanFreehandStroke } from '@/lib/freehandCleanup'
import OpeningElevationEditor from '@/components/OpeningElevationEditor'

type Drawing = { id: string; name: string | null; image_url: string | null; project_id: string }
type Point = { x: number; y: number }
type Room = { id: string; name: string; pin_x: number; pin_y: number; boundary: Point[] | null }
type Measurement = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  value_mm: number
  label: string | null
  created_by: string | null
  created_at: string
}
type Opening = {
  id: string
  type: 'door' | 'window'
  x: number
  y: number
  rotation: number
  width_mm: number
  height_mm: number
  sill_height_mm: number | null
  label: string | null
  created_by: string | null
}



function centroid(points: Point[]): Point {
  const n = points.length
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / n, y: sum.y / n }
}

function formatMm(valueMm: number): string {
  return valueMm >= 1000 ? `${(valueMm / 1000).toFixed(valueMm % 1000 === 0 ? 0 : 2)} m` : `${valueMm} mm`
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminDebug, setAdminDebug] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [dimensionMode, setDimensionMode] = useState(false)
  const [dimensionPoints, setDimensionPoints] = useState<Point[]>([])
  const [dimensionValue, setDimensionValue] = useState('')
  const [dimensionUnit, setDimensionUnit] = useState<'mm' | 'm'>('mm')
  const [dimensionLabel, setDimensionLabel] = useState('')
  const [savingDimension, setSavingDimension] = useState(false)
  const [dimensionError, setDimensionError] = useState<string | null>(null)
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null)

  const [openings, setOpenings] = useState<Opening[]>([])
  const [insertMode, setInsertMode] = useState(false)
  const [pendingOpeningType, setPendingOpeningType] = useState<'door' | 'window' | null>(null)
  const [pendingOpeningPoint, setPendingOpeningPoint] = useState<Point | null>(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [openingWidth, setOpeningWidth] = useState(900)
  const [openingHeight, setOpeningHeight] = useState(2100)
  const [openingSill, setOpeningSill] = useState(900)
  const [openingRotation, setOpeningRotation] = useState(0)
  const [openingLabel, setOpeningLabel] = useState('')
  const [savingOpening, setSavingOpening] = useState(false)
  const [openingError, setOpeningError] = useState<string | null>(null)
  const [deletingOpeningId, setDeletingOpeningId] = useState<string | null>(null)

  const [markingMode, setMarkingMode] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [freehandMode, setFreehandMode] = useState(false)
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false)
  const [freehandRawPoints, setFreehandRawPoints] = useState<Point[]>([])
  const [drawPoints, setDrawPoints] = useState<Point[]>([])
  const [roomName, setRoomName] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectingBoundary, setDetectingBoundary] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [snapshotRoomId, setSnapshotRoomId] = useState<string | null>(null)
  const [imgAspect, setImgAspect] = useState(1)
  const [boundaryError, setBoundaryError] = useState<string | null>(null)
  const [deletingRoom, setDeletingRoom] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingBoundary, setEditingBoundary] = useState(false)
  const [editPoints, setEditPoints] = useState<Point[]>([])
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

    const { data: measurementData } = await supabase
      .from('as_built_measurements')
      .select('id, x1, y1, x2, y2, value_mm, label, created_by, created_at')
      .eq('drawing_id', drawingId)
      .order('created_at', { ascending: true })
    setMeasurements(measurementData || [])

    const { data: openingData } = await supabase
      .from('drawing_openings')
      .select('id, type, x, y, rotation, width_mm, height_mm, sill_height_mm, label, created_by')
      .eq('drawing_id', drawingId)
      .order('created_at', { ascending: true })
    setOpenings(openingData || [])

    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id || null)

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_admin')
        .eq('id', user.id)
        .single()
      if (profileError) {
        setAdminDebug(`Profile query error: ${profileError.message}`)
      } else {
        setAdminDebug(`Profile row: ${JSON.stringify(profile)}`)
      }
      setIsAdmin(profile?.company_admin === true)
    } else {
      setAdminDebug('No authenticated user found')
    }

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
    if (editingBoundary) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (dimensionMode) {
      if (dimensionPoints.length >= 2) return
      setDimensionPoints((prev) => [...prev, { x, y }])
      return
    }

    if (insertMode) {
      if (!pendingOpeningType || pendingOpeningPoint) return
      setSelectedOpeningId(null)
      setPendingOpeningPoint({ x, y })
      return
    }

    if (markingMode && !isAdmin) return

    if (markingMode && manualMode && freehandMode) return

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

  function toggleDimensionMode() {
    setDimensionMode((m) => !m)
    setMarkingMode(false)
    setManualMode(false)
    setFreehandMode(false)
    setIsFreehandDrawing(false)
    setFreehandRawPoints([])
    setPin(null)
    setDrawPoints([])
    setRoomName('')
    setSelectedRoomId(null)
    setDimensionPoints([])
    setDimensionValue('')
    setDimensionUnit('mm')
    setDimensionLabel('')
    setDimensionError(null)
    setInsertMode(false)
    resetOpeningForm()
  }

  function cancelDimension() {
    setDimensionPoints([])
    setDimensionValue('')
    setDimensionLabel('')
    setDimensionError(null)
  }

  function toggleInsertMode() {
    setInsertMode((m) => !m)
    setDimensionMode(false)
    setDimensionPoints([])
    setMarkingMode(false)
    setManualMode(false)
    setFreehandMode(false)
    setIsFreehandDrawing(false)
    setFreehandRawPoints([])
    setPin(null)
    setDrawPoints([])
    setRoomName('')
    setSelectedRoomId(null)
    setSnapshotRoomId(null)
    resetOpeningForm()
  }

  // A cropped, zoomed-in window onto one room, so you can jump straight into
  // recording its as-built dimensions without opening the full drawing and
  // pinch-zooming to find it. Uses one uniform scale for both axes (not
  // independent x/y) and an outer box matching the photo's own aspect ratio
  // (imgAspect) - otherwise the photo itself would render visibly stretched,
  // unlike the abstract overlay lines elsewhere in this file which can take
  // that shortcut because they're not photographic content.
  function roomSnapshotCrop(boundary: Point[]) {
    const xs = boundary.map((p) => p.x)
    const ys = boundary.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const padX = Math.max(6, (maxX - minX) * 0.25)
    const padY = Math.max(6, (maxY - minY) * 0.25)
    const boxW = Math.max(Math.min(100, maxX + padX) - Math.max(0, minX - padX), 8)
    const boxH = Math.max(Math.min(100, maxY + padY) - Math.max(0, minY - padY), 8)
    const cx = Math.max(0, minX - padX) + boxW / 2
    const cy = Math.max(0, minY - padY) + boxH / 2
    const scale = 100 / Math.max(boxW, boxH)
    return { left: 50 - cx * scale, top: 50 - cy * scale, width: scale * 100, height: scale * 100 }
  }

  function openRoomSnapshot(roomId: string) {
    setMarkingMode(false)
    setManualMode(false)
    setFreehandMode(false)
    setIsFreehandDrawing(false)
    setFreehandRawPoints([])
    setInsertMode(false)
    resetOpeningForm()
    setEditingBoundary(false)
    setEditPoints([])
    setPin(null)
    setDrawPoints([])
    setSelectedRoomId(roomId)
    setSnapshotRoomId(roomId)
  }

  function closeRoomSnapshot() {
    setSnapshotRoomId(null)
    setDimensionMode(false)
    setDimensionPoints([])
    setDimensionValue('')
    setDimensionLabel('')
    setDimensionError(null)
  }

  function resetOpeningForm() {
    setPendingOpeningType(null)
    setPendingOpeningPoint(null)
    setSelectedOpeningId(null)
    setOpeningLabel('')
    setOpeningRotation(0)
    setOpeningError(null)
  }

  function handlePickOpeningType(type: 'door' | 'window') {
    setPendingOpeningType(type)
    setPendingOpeningPoint(null)
    setSelectedOpeningId(null)
    setOpeningRotation(0)
    setOpeningLabel('')
    setOpeningError(null)
    if (type === 'door') {
      setOpeningWidth(900)
      setOpeningHeight(2100)
      setOpeningSill(0)
    } else {
      setOpeningWidth(1200)
      setOpeningHeight(1200)
      setOpeningSill(900)
    }
  }

  function handleSelectExistingOpening(o: Opening) {
    setSelectedOpeningId(o.id)
    setPendingOpeningType(null)
    setPendingOpeningPoint(null)
    setOpeningWidth(o.width_mm)
    setOpeningHeight(o.height_mm)
    setOpeningSill(o.sill_height_mm || 0)
    setOpeningRotation(o.rotation)
    setOpeningLabel(o.label || '')
    setOpeningError(null)
  }

  async function handleSaveOpening() {
    if (!openingWidth || !openingHeight) {
      setOpeningError('Enter a width and height first.')
      return
    }
    setSavingOpening(true)
    setOpeningError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (selectedOpeningId) {
      const { error } = await supabase
        .from('drawing_openings')
        .update({
          width_mm: openingWidth,
          height_mm: openingHeight,
          sill_height_mm: openingSill || null,
          rotation: openingRotation,
          label: openingLabel.trim() || null,
        })
        .eq('id', selectedOpeningId)

      if (error) {
        setOpeningError(`Could not save: ${error.message}`)
        setSavingOpening(false)
        return
      }
    } else {
      if (!pendingOpeningType || !pendingOpeningPoint) {
        setSavingOpening(false)
        return
      }
      const { error } = await supabase.from('drawing_openings').insert({
        drawing_id: drawingId,
        type: pendingOpeningType,
        x: pendingOpeningPoint.x,
        y: pendingOpeningPoint.y,
        rotation: openingRotation,
        width_mm: openingWidth,
        height_mm: openingHeight,
        sill_height_mm: pendingOpeningType === 'window' ? openingSill || null : null,
        label: openingLabel.trim() || null,
        created_by: user?.id,
      })

      if (error) {
        setOpeningError(`Could not save: ${error.message}`)
        setSavingOpening(false)
        return
      }
    }

    resetOpeningForm()
    setSavingOpening(false)
    load()
  }

  async function handleDeleteOpening(id: string) {
    setDeletingOpeningId(id)
    const { error } = await supabase.from('drawing_openings').delete().eq('id', id)
    if (!error) {
      resetOpeningForm()
      load()
    }
    setDeletingOpeningId(null)
  }

  async function handleSaveDimension() {
    if (dimensionPoints.length < 2) return
    const numeric = parseFloat(dimensionValue)
    if (!numeric || numeric <= 0) {
      setDimensionError('Enter the measured value first.')
      return
    }
    setSavingDimension(true)
    setDimensionError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const valueMm = dimensionUnit === 'm' ? numeric * 1000 : numeric

    const { error } = await supabase.from('as_built_measurements').insert({
      drawing_id: drawingId,
      x1: dimensionPoints[0].x,
      y1: dimensionPoints[0].y,
      x2: dimensionPoints[1].x,
      y2: dimensionPoints[1].y,
      value_mm: valueMm,
      label: dimensionLabel.trim() || null,
      created_by: user?.id,
    })

    if (error) {
      setDimensionError(`Could not save: ${error.message}`)
      setSavingDimension(false)
      return
    }

    setDimensionPoints([])
    setDimensionValue('')
    setDimensionLabel('')
    setSavingDimension(false)
    load()
  }

  async function handleDeleteMeasurement(id: string) {
    setDeletingMeasurementId(id)
    const { error } = await supabase.from('as_built_measurements').delete().eq('id', id)
    if (!error) load()
    setDeletingMeasurementId(null)
  }

  function handleRoomClick(e: React.MouseEvent, roomId: string) {
    e.stopPropagation()
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
    if (!isAdmin) return
    if (drawPoints.length < 3 || !roomName.trim()) return
    setSavingRoom(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const center = centroid(drawPoints)

    const { error } = await supabase.from('rooms').insert({
      drawing_id: drawingId,
      name: roomName.trim(),
      pin_x: center.x,
      pin_y: center.y,
      boundary: drawPoints,
      created_by: user?.id,
    })

    if (error) {
      setBoundaryError(`Could not save room: ${error.message}`)
      setSavingRoom(false)
      return
    }

    setRoomName('')
    setDrawPoints([])
    setMarkingMode(false)
    setManualMode(false)
    setFreehandMode(false)
    setSavingRoom(false)
    load()
  }

  async function handleDeleteRoom(roomId: string) {
    if (!isAdmin) return
    setDeletingRoom(true)
    setDeleteError(null)

    const { error } = await supabase.from('rooms').delete().eq('id', roomId)

    if (error) {
      setDeleteError(error.message)
      setDeletingRoom(false)
      return
    }

    setSelectedRoomId(null)
    setDeletingRoom(false)
    load()
  }

  function startEditingBoundary(room: Room) {
    if (!isAdmin || !room.boundary) return
    setEditingBoundary(true)
    setEditPoints(room.boundary.map((p) => ({ ...p })))
    setEditError(null)
  }

  function cancelEditingBoundary() {
    setEditingBoundary(false)
    setEditPoints([])
    setDraggingPointIndex(null)
    setEditError(null)
  }

  function pointFromClientCoords(clientX: number, clientY: number): Point {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  function handlePointDragStart(index: number, e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation()
    setDraggingPointIndex(index)
  }

  function handleFreehandStart(e: React.MouseEvent | React.TouchEvent) {
    if (!(markingMode && manualMode && freehandMode)) return
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsFreehandDrawing(true)
    setFreehandRawPoints([pointFromClientCoords(clientX, clientY)])
  }

  function handleContainerPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (isFreehandDrawing) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      setFreehandRawPoints((prev) => [...prev, pointFromClientCoords(clientX, clientY)])
      return
    }
    if (draggingPointIndex === null) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const next = pointFromClientCoords(clientX, clientY)
    setEditPoints((prev) => {
      const updated = [...prev]
      updated[draggingPointIndex] = next
      return updated
    })
  }

  function handleContainerPointerUp() {
    if (isFreehandDrawing) {
      setIsFreehandDrawing(false)
      // Snaps near-straight runs flat and smooths genuine curves, rather
      // than saving every hand-tremor wobble in the raw stroke.
      if (freehandRawPoints.length >= 3) {
        setDrawPoints(cleanFreehandStroke(freehandRawPoints))
      }
      setFreehandRawPoints([])
      return
    }
    setDraggingPointIndex(null)
  }

  async function handleSaveBoundaryEdit(room: Room) {
    if (!isAdmin || editPoints.length < 3) return
    setSavingEdit(true)
    setEditError(null)

    const center = centroid(editPoints)

    const { error } = await supabase
      .from('rooms')
      .update({ boundary: editPoints, pin_x: center.x, pin_y: center.y })
      .eq('id', room.id)

    if (error) {
      setEditError(error.message)
      setSavingEdit(false)
      return
    }

    setSavingEdit(false)
    setEditingBoundary(false)
    setEditPoints([])
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
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!drawing) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Drawing not found.</p>
      </div>
    )
  }

  const drawPointsStr = drawPoints.map((p) => `${p.x}%,${p.y}%`).join(' ')
  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null
  const hasImage = !!drawing.image_url
  const snapshotRoom = snapshotRoomId ? rooms.find((r) => r.id === snapshotRoomId) : null
  const snapshotCrop =
    snapshotRoom?.boundary && snapshotRoom.boundary.length >= 3 ? roomSnapshotCrop(snapshotRoom.boundary) : null

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={drawing.name || 'Drawing'} />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleDimensionMode}
            className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium ${
              dimensionMode
                ? 'border-deck-accent bg-deck-accent text-white'
                : 'border-deck-border bg-deck-surface text-deck-text hover:bg-deck-raised'
            }`}
          >
            {dimensionMode ? 'Cancel dimension' : 'Record as-built dimension'}
          </button>
          <button
            onClick={toggleInsertMode}
            className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium ${
              insertMode
                ? 'border-deck-accent bg-deck-accent text-white'
                : 'border-deck-border bg-deck-surface text-deck-text hover:bg-deck-raised'
            }`}
          >
            {insertMode ? 'Cancel shape' : 'Insert door / window'}
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setMarkingMode((m) => !m)
                // No photo to auto-detect walls from on a blank plan - manual
                // corner-tapping is the only option there.
                setManualMode(!hasImage)
                setFreehandMode(false)
                setIsFreehandDrawing(false)
                setFreehandRawPoints([])
                setPin(null)
                setDrawPoints([])
                // A blank plan's first room is usually the one location the
                // plan was named for - prefill it so the name isn't typed
                // twice, but still editable for a plan with several rooms.
                setRoomName(!hasImage && rooms.length === 0 ? drawing?.name || '' : '')
                setSelectedRoomId(null)
                setSnapshotRoomId(null)
                setBoundaryError(null)
                setDimensionMode(false)
                setDimensionPoints([])
                setInsertMode(false)
                resetOpeningForm()
              }}
              className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium ${
                markingMode
                  ? 'border-deck-accent bg-deck-accent text-white'
                  : 'border-deck-border bg-deck-surface text-deck-text hover:bg-deck-raised'
              }`}
            >
              {markingMode ? 'Cancel marking' : hasImage ? 'Mark rooms' : 'Draw room outline'}
            </button>
          )}
        </div>
        {rooms.length > 0 && (
          <div className="mt-3">
            {snapshotCrop ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-deck-border bg-deck-raised px-3 py-2">
                <p className="min-w-0 truncate text-sm font-medium text-deck-text">
                  Zoomed in: {snapshotRoom?.name}
                </p>
                <button
                  onClick={closeRoomSnapshot}
                  className="shrink-0 text-xs font-medium text-deck-accent underline"
                >
                  Back to full drawing
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">Rooms</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => openRoomSnapshot(r.id)}
                      disabled={!r.boundary || r.boundary.length < 3}
                      className="rounded-full border border-deck-border bg-deck-surface px-3 py-1 text-xs font-medium text-deck-text disabled:opacity-40"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TEMPORARY DEBUG - remove once admin gating is confirmed working */}
        {adminDebug && (
          <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-700">
            DEBUG — isAdmin: {String(isAdmin)} | {adminDebug}
          </p>
        )}

        <p className="mt-1 text-sm text-deck-dim">
          {snapshotCrop && !dimensionMode && !insertMode && 'Tap "Record as-built dimension" to measure this room, or "Back to full drawing" above to leave.'}
          {dimensionMode && dimensionPoints.length === 0 && 'Tap the first point of the dimension on the drawing.'}
          {dimensionMode && dimensionPoints.length === 1 && 'Now tap the second point.'}
          {dimensionMode && dimensionPoints.length === 2 && 'Enter the measured value below and save.'}
          {!dimensionMode && markingMode && !manualMode && 'Tap once inside a room - AI will trace its walls automatically.'}
          {!dimensionMode && markingMode && manualMode && freehandMode && 'Press and drag to draw the outline free-hand - wobbly lines are straightened or smoothed into curves automatically when you lift up.'}
          {!dimensionMode && markingMode && manualMode && !freehandMode && `Tap each corner of the room in order (${drawPoints.length} point${drawPoints.length === 1 ? '' : 's'} so far). Need at least 3.`}
          {insertMode && !pendingOpeningType && 'Pick Door or Window below, then tap where it sits on the plan.'}
          {insertMode && pendingOpeningType && !pendingOpeningPoint && `Tap where this ${pendingOpeningType} sits on the plan.`}
          {insertMode && pendingOpeningPoint && 'Set its dimensions below and save.'}
          {!dimensionMode && !markingMode && !insertMode && !snapshotCrop && hasImage && 'Tap the drawing to drop a pin at your location. Tap a highlighted room to see its name and options.'}
          {!dimensionMode && !markingMode && !insertMode && !snapshotCrop && !hasImage && 'This is a blank plan - use "Draw room outline" to sketch a room, then "Record as-built dimension" to add its measured wall lengths.'}
        </p>

        <div
          className="relative mt-4 w-full overflow-hidden rounded-lg border border-deck-border"
          style={snapshotCrop ? { aspectRatio: `${imgAspect} / 1` } : undefined}
        >
        <div
          ref={containerRef}
          className={snapshotCrop ? 'absolute cursor-crosshair' : 'relative w-full cursor-crosshair'}
          onClick={handleImageClick}
          onMouseDown={handleFreehandStart}
          onTouchStart={handleFreehandStart}
          onMouseMove={handleContainerPointerMove}
          onMouseUp={handleContainerPointerUp}
          onTouchMove={handleContainerPointerMove}
          onTouchEnd={handleContainerPointerUp}
          style={
            snapshotCrop
              ? {
                  left: `${snapshotCrop.left}%`,
                  top: `${snapshotCrop.top}%`,
                  width: `${snapshotCrop.width}%`,
                  height: `${snapshotCrop.height}%`,
                }
              : { touchAction: markingMode && manualMode && freehandMode ? 'none' : undefined }
          }
        >
          {hasImage ? (
            <img
              ref={imgRef}
              src={drawing.image_url!}
              alt={drawing.name || 'Drawing'}
              className="w-full"
              crossOrigin="anonymous"
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) setImgAspect(el.naturalWidth / el.naturalHeight)
              }}
            />
          ) : (
            <div
              className="aspect-square w-full"
              style={{
                backgroundColor: '#F5F3EE',
                backgroundImage:
                  'linear-gradient(to right, rgba(36,34,29,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(36,34,29,0.08) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
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
              // Only catches clicks (for room selection) when just browsing -
              // in dimension or marking mode it must let taps through to the
              // container, or a saved room's own area would be permanently
              // dead space for adding dimensions, pins or new corners inside it.
              const roomsClickable = !dimensionMode && !markingMode
              return (
                <polygon
                  key={r.id}
                  points={pointsStr}
                  fill={isSelected ? 'rgba(13,148,136,0.35)' : 'rgba(20,184,166,0.2)'}
                  stroke={isSelected ? 'rgba(13,148,136,0.9)' : 'rgba(13,148,136,0.5)'}
                  strokeWidth={0.3}
                  className={roomsClickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                  onClick={roomsClickable ? (e: any) => handleRoomClick(e, r.id) : undefined}
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

            {isFreehandDrawing && freehandRawPoints.length > 1 && (
              <polyline
                points={freehandRawPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(217,119,6,0.85)"
                strokeWidth={0.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {editingBoundary && editPoints.length > 0 && (
              <polygon
                points={editPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(37,99,235,0.2)"
                stroke="rgba(37,99,235,0.9)"
                strokeWidth={0.3}
              />
            )}

            {measurements.map((m) => {
              const dx = m.x2 - m.x1
              const dy = m.y2 - m.y1
              const len = Math.hypot(dx, dy) || 1
              const perpX = (-dy / len) * 1.4
              const perpY = (dx / len) * 1.4
              return (
                <g key={m.id}>
                  <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#1F565C" strokeWidth={0.35} />
                  <line x1={m.x1 - perpX} y1={m.y1 - perpY} x2={m.x1 + perpX} y2={m.y1 + perpY} stroke="#1F565C" strokeWidth={0.35} />
                  <line x1={m.x2 - perpX} y1={m.y2 - perpY} x2={m.x2 + perpX} y2={m.y2 + perpY} stroke="#1F565C" strokeWidth={0.35} />
                </g>
              )
            })}

            {dimensionPoints.length === 2 && (
              <line
                x1={dimensionPoints[0].x}
                y1={dimensionPoints[0].y}
                x2={dimensionPoints[1].x}
                y2={dimensionPoints[1].y}
                stroke="#D97706"
                strokeWidth={0.4}
                strokeDasharray="1.5,1"
              />
            )}
          </svg>

          {measurements.map((m) => (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: `${(m.x1 + m.x2) / 2}%`,
                top: `${(m.y1 + m.y2) / 2}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="pointer-events-none whitespace-nowrap rounded bg-deck-raised/95 px-1.5 py-0.5 text-[10px] font-medium text-deck-text shadow"
            >
              {formatMm(m.value_mm)}
              {m.label ? ` — ${m.label}` : ''}
            </div>
          ))}

          {dimensionPoints.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="h-3 w-3 rounded-full border-2 border-white bg-amber-600 shadow"
            />
          ))}

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
              className="pointer-events-none whitespace-nowrap rounded bg-deck-raised/95 px-2 py-1 text-[11px] font-medium text-deck-text"
            >
              {selectedRoom.name}
            </div>
          )}

          {editingBoundary &&
            editPoints.map((p, i) => (
              <div
                key={i}
                onMouseDown={(e) => handlePointDragStart(i, e)}
                onTouchStart={(e) => handlePointDragStart(i, e)}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%, -50%)',
                  touchAction: 'none',
                }}
                className="h-4 w-4 cursor-grab rounded-full border-2 border-white bg-blue-600 shadow active:cursor-grabbing"
              />
            ))}

          {pin && (
            <div
              style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow" />
            </div>
          )}

          {openings.map((o) => {
            // Same idea as roomsClickable - block taps on the icon while a
            // new opening's point is about to be placed, so the tap lands on
            // the drawing (handleImageClick) instead of diverting to edit.
            const openingsClickable = !dimensionMode && !markingMode && !(pendingOpeningType && !pendingOpeningPoint)
            return (
              <div
                key={o.id}
                onClick={
                  openingsClickable
                    ? (e) => {
                        e.stopPropagation()
                        handleSelectExistingOpening(o)
                      }
                    : undefined
                }
                style={{
                  position: 'absolute',
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
                }}
                className={openingsClickable ? 'cursor-pointer' : 'pointer-events-none'}
              >
                <svg width="26" height="26" viewBox="0 0 26 26">
                  {o.type === 'door' ? (
                    <>
                      <line x1="3" y1="23" x2="3" y2="3" stroke="#8A5A2B" strokeWidth="2" />
                      <path d="M 3 23 A 20 20 0 0 1 23 3" fill="none" stroke="#8A5A2B" strokeWidth="1" strokeDasharray="2,2" />
                    </>
                  ) : (
                    <>
                      <line x1="1" y1="13" x2="25" y2="13" stroke="#1F565C" strokeWidth="3" />
                      <line x1="1" y1="9" x2="25" y2="9" stroke="#1F565C" strokeWidth="1" />
                      <line x1="1" y1="17" x2="25" y2="17" stroke="#1F565C" strokeWidth="1" />
                    </>
                  )}
                </svg>
              </div>
            )
          })}

          {pendingOpeningPoint && (
            <div
              style={{
                position: 'absolute',
                left: `${pendingOpeningPoint.x}%`,
                top: `${pendingOpeningPoint.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="h-4 w-4 rounded-full border-2 border-white bg-teal-600 shadow"
            />
          )}
        </div>
        </div>

        {dimensionMode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {dimensionPoints.length < 2 ? (
              <p className="text-sm text-amber-800">
                {dimensionPoints.length === 0 ? 'Tap the first point on the drawing.' : 'Tap the second point on the drawing.'}
              </p>
            ) : (
              <>
                <label className="block text-sm font-medium text-deck-body">Measured value</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={dimensionValue}
                    onChange={(e) => setDimensionValue(e.target.value)}
                    placeholder="e.g. 3050"
                    className="w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                  />
                  <select
                    value={dimensionUnit}
                    onChange={(e) => setDimensionUnit(e.target.value as 'mm' | 'm')}
                    className="rounded-md border border-deck-border bg-deck-surface px-2 py-2 text-sm text-deck-text"
                  >
                    <option value="mm">mm</option>
                    <option value="m">m</option>
                  </select>
                </div>

                <DistoConnect
                  onUseReading={(mm) => {
                    setDimensionValue(String(mm))
                    setDimensionUnit('mm')
                  }}
                />

                <label className="mt-3 block text-sm font-medium text-deck-body">Label (optional)</label>
                <input
                  type="text"
                  spellCheck="true"
                  value={dimensionLabel}
                  onChange={(e) => setDimensionLabel(e.target.value)}
                  placeholder="e.g. Corridor clear width"
                  className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                />
                {dimensionError && <p className="mt-2 text-xs text-red-600">{dimensionError}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSaveDimension}
                    disabled={savingDimension || !dimensionValue}
                    className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                  >
                    {savingDimension ? 'Saving...' : 'Save dimension'}
                  </button>
                  <button
                    onClick={cancelDimension}
                    disabled={savingDimension}
                    className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {insertMode && !pendingOpeningType && !selectedOpeningId && (
          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
            <p className="text-sm font-medium text-deck-text">Insert a door or window</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handlePickOpeningType('door')}
                className="flex-1 rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm font-medium text-deck-text"
              >
                Door
              </button>
              <button
                onClick={() => handlePickOpeningType('window')}
                className="flex-1 rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm font-medium text-deck-text"
              >
                Window
              </button>
            </div>
          </div>
        )}

        {((insertMode && pendingOpeningType && pendingOpeningPoint) || selectedOpeningId) && (
          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
            <p className="text-sm font-medium text-deck-text">
              {selectedOpeningId
                ? `Edit ${openings.find((o) => o.id === selectedOpeningId)?.type || 'opening'}`
                : `New ${pendingOpeningType}`}
            </p>

            <div className="mt-2">
              <OpeningElevationEditor
                type={
                  (selectedOpeningId
                    ? openings.find((o) => o.id === selectedOpeningId)?.type
                    : pendingOpeningType) || 'door'
                }
                widthMm={openingWidth}
                heightMm={openingHeight}
                sillMm={openingSill}
                onWidthChange={setOpeningWidth}
                onHeightChange={setOpeningHeight}
                onSillChange={setOpeningSill}
              />
            </div>

            <label className="mt-3 block text-sm font-medium text-deck-body">Rotation</label>
            <div className="mt-1 flex gap-2">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  onClick={() => setOpeningRotation(deg)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                    openingRotation === deg
                      ? 'border-deck-accent bg-deck-accent text-deck-bg'
                      : 'border-deck-border bg-deck-surface text-deck-body'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>

            <label className="mt-3 block text-sm font-medium text-deck-body">Label (optional)</label>
            <input
              type="text"
              spellCheck="true"
              value={openingLabel}
              onChange={(e) => setOpeningLabel(e.target.value)}
              placeholder="e.g. Front door"
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
            />

            {openingError && <p className="mt-2 text-xs text-red-600">{openingError}</p>}

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSaveOpening}
                disabled={savingOpening}
                className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                {savingOpening ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={resetOpeningForm}
                disabled={savingOpening}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
              >
                Cancel
              </button>
              {selectedOpeningId && (
                <button
                  onClick={() => handleDeleteOpening(selectedOpeningId)}
                  disabled={deletingOpeningId === selectedOpeningId}
                  className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  {deletingOpeningId === selectedOpeningId ? 'Removing...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        )}

        {openings.length > 0 && (
          <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">Doors &amp; windows</p>
            <div className="mt-2 space-y-2">
              {openings.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <button onClick={() => handleSelectExistingOpening(o)} className="min-w-0 text-left">
                    <span className="font-medium capitalize text-deck-text">{o.type}</span>
                    <span className="text-deck-dim">
                      {' '}
                      — {formatMm(o.width_mm)} × {formatMm(o.height_mm)}
                      {o.label ? ` — ${o.label}` : ''}
                    </span>
                  </button>
                  {(isAdmin || o.created_by === userId) && (
                    <button
                      onClick={() => handleDeleteOpening(o.id)}
                      disabled={deletingOpeningId === o.id}
                      className="shrink-0 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      {deletingOpeningId === o.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {measurements.length > 0 && (
          <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">As-built dimensions</p>
            <div className="mt-2 space-y-2">
              {measurements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-deck-text">{formatMm(m.value_mm)}</span>
                    {m.label && <span className="text-deck-dim"> — {m.label}</span>}
                  </div>
                  {(isAdmin || m.created_by === userId) && (
                    <button
                      onClick={() => handleDeleteMeasurement(m.id)}
                      disabled={deletingMeasurementId === m.id}
                      className="shrink-0 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      {deletingMeasurementId === m.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-deck-dim">
              This drawing's full as-built record (all dimensions, printable to share with the design team) is on the{' '}
              <button
                onClick={() => router.push(`/dashboard/projects/${drawing.project_id}/as-built`)}
                className="font-medium text-deck-accent underline"
              >
                project's as-built page
              </button>
              .
            </p>
          </div>
        )}

        {selectedRoom && !markingMode && isAdmin && !editingBoundary && (
          <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-deck-text">{selectedRoom.name}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => startEditingBoundary(selectedRoom)}
                  className="text-xs font-medium text-deck-body underline"
                >
                  Adjust boundary
                </button>
                <button
                  onClick={() => handleDeleteRoom(selectedRoom.id)}
                  disabled={deletingRoom}
                  className="text-xs font-medium text-red-600 disabled:opacity-50"
                >
                  {deletingRoom ? 'Removing...' : 'Remove this markup'}
                </button>
              </div>
            </div>
            {deleteError && (
              <p className="mt-2 text-xs text-red-600">Could not remove: {deleteError}</p>
            )}
          </div>
        )}

        {selectedRoom && editingBoundary && isAdmin && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-medium text-deck-text">Adjusting: {selectedRoom.name}</p>
            <p className="mt-1 text-xs text-deck-dim">Drag the blue points to match the room's actual corners.</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleSaveBoundaryEdit(selectedRoom)}
                disabled={savingEdit || editPoints.length < 3}
                className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={cancelEditingBoundary}
                disabled={savingEdit}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {editError && (
              <p className="mt-2 text-xs text-red-600">Could not save: {editError}</p>
            )}
          </div>
        )}

        {selectedRoom && !markingMode && !isAdmin && (
          <div className="mt-3 rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-sm font-medium text-deck-text">{selectedRoom.name}</p>
          </div>
        )}

        {markingMode && isAdmin && (
          <div className="mt-4 rounded-lg border border-deck-border bg-deck-surface p-4">
            {detectingBoundary && (
              <p className="text-sm text-deck-dim">Tracing room walls...</p>
            )}

            {boundaryError && !detectingBoundary && (
              <p className="text-sm text-amber-700">{boundaryError}</p>
            )}

            {!manualMode && !detectingBoundary && drawPoints.length === 0 && !boundaryError && (
              <button
                onClick={() => setManualMode(true)}
                className="text-xs font-medium text-deck-dim underline"
              >
                Prefer to draw it manually instead?
              </button>
            )}

            {manualMode && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFreehandMode(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                      !freehandMode ? 'border-deck-accent bg-deck-raised text-deck-accent' : 'border-deck-border text-deck-body'
                    }`}
                  >
                    Tap corners
                  </button>
                  <button
                    onClick={() => setFreehandMode(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                      freehandMode ? 'border-deck-accent bg-deck-raised text-deck-accent' : 'border-deck-border text-deck-body'
                    }`}
                  >
                    Freehand
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  {!freehandMode && (
                    <button
                      onClick={undoLastPoint}
                      disabled={drawPoints.length === 0}
                      className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
                    >
                      Undo last point
                    </button>
                  )}
                  <button
                    onClick={clearDrawing}
                    disabled={drawPoints.length === 0}
                    className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                {freehandMode && drawPoints.length > 0 && (
                  <p className="mt-2 text-xs text-deck-dim">
                    Not quite right? Just draw over it again - a new stroke replaces the last one.
                  </p>
                )}
              </>
            )}

            {!manualMode && boundaryError && (
              <button
                onClick={() => setManualMode(true)}
                className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body"
              >
                Draw manually instead
              </button>
            )}

            {drawPoints.length >= 3 && (
              <>
                <label className="mt-4 block text-sm font-medium text-deck-body">Room name</label>
                <input spellCheck="true"
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Bathroom 214"
                  className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                />
                <button
                  onClick={handleSaveRoom}
                  disabled={savingRoom || !roomName.trim()}
                  className="mt-2 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                >
                  {savingRoom ? 'Saving...' : 'Save room'}
                </button>
                <p className="mt-2 text-xs text-deck-dim">
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
              <p className="text-sm font-medium text-deck-body">Nearest marked room: {nearestRoom.name}</p>
            )}
            <button
              onClick={handleStartInspection}
              className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg"
            >
              Start inspection here
            </button>
            <button
              onClick={handleRaiseDefect}
              className="w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body"
            >
              Raise a one-off defect here
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
