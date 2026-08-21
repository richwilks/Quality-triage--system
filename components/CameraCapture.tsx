'use client'

import { useEffect, useRef, useState } from 'react'

export type OrientationHint = {
  betaDeg: number
  guess: 'floor' | 'wall' | 'ceiling' | 'uncertain'
}

// beta = front-to-back tilt in degrees (DeviceOrientationEvent). ~90 = phone held upright,
// rear camera pointing roughly level (a wall). Tilting the top of the phone down toward the
// floor pushes beta up toward 180; tilting it up toward the ceiling pushes beta down toward 0.
// This is a rough physical heuristic, not a content guess - the caller should always still
// trust the photo itself over this hint.
export function guessFromBeta(beta: number): OrientationHint['guess'] {
  if (beta === null || Number.isNaN(beta) || beta < 0 || beta > 180) return 'uncertain'
  if (beta > 120) return 'floor'
  if (beta < 60) return 'ceiling'
  return 'wall'
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4

function pinchDistance(touches: React.TouchList | TouchList) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.hypot(dx, dy)
}

export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File, orientation: OrientationHint | null) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const latestBetaRef = useRef<number | null>(null)
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let cancelled = false

    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.beta !== null && e.beta !== undefined) {
        latestBetaRef.current = e.beta
      }
    }

    async function start() {
      try {
        const DOE = (window as any).DeviceOrientationEvent
        if (DOE && typeof DOE.requestPermission === 'function') {
          try {
            await DOE.requestPermission()
          } catch {
            // Permission denied or unsupported - we just won't get an orientation hint.
          }
        }
        window.addEventListener('deviceorientation', handleOrientation)

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not access the camera. You can still choose a photo from your library.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      window.removeEventListener('deviceorientation', handleOrientation)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchStartRef.current = { distance: pinchDistance(e.touches), zoom }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    const start = pinchStartRef.current
    if (!start || e.touches.length !== 2) return
    e.preventDefault()
    const distance = pinchDistance(e.touches)
    const next = start.zoom * (distance / start.distance)
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)))
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchStartRef.current = null
  }

  function handleShutter() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Crop to the same region the zoomed preview is showing (centred), then scale back up
    // to full resolution - the capture has to match what's on screen, not the raw camera
    // frame, otherwise zooming in visually would do nothing to the saved photo.
    const sw = video.videoWidth / zoom
    const sh = video.videoHeight / zoom
    const sx = (video.videoWidth - sw) / 2
    const sy = (video.videoHeight - sh) / 2
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    const beta = latestBetaRef.current
    const orientation: OrientationHint | null =
      beta === null ? null : { betaDeg: beta, guess: guessFromBeta(beta) }

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file, orientation)
      },
      'image/jpeg',
      0.9
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-white">{error}</p>
          <button
            onClick={onClose}
            className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white"
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <div
            className="relative flex-1 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />

            {zoom > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                {zoom.toFixed(1)}x
              </span>
            )}

            <div className="absolute bottom-4 right-3 flex h-40 items-center">
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="h-40 w-8"
                style={{
                  writingMode: 'vertical-lr' as any,
                  direction: 'rtl',
                  touchAction: 'none',
                }}
                aria-label="Zoom"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 bg-black p-4 pb-[env(safe-area-inset-bottom)]">
            <button
              onClick={onClose}
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleShutter}
              disabled={!ready}
              aria-label="Take photo"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
            />
            <div className="w-[72px]" />
          </div>
        </>
      )}
    </div>
  )
}
