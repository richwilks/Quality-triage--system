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

const DIGITAL_ZOOM_MIN = 1
const DIGITAL_ZOOM_MAX = 4

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
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const latestBetaRef = useRef<number | null>(null)
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)

  // Native (optical/sensor-level) zoom range, only set when the device/browser actually
  // exposes it - otherwise we fall back to the crop-based digital zoom that already works
  // everywhere. Applying both at once would double-zoom, so exactly one path is active.
  const [nativeZoomRange, setNativeZoomRange] = useState<{ min: number; max: number; step: number } | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [tapFocusSupported, setTapFocusSupported] = useState(false)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)

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
        const track = stream.getVideoTracks()[0]
        trackRef.current = track || null

        if (track && typeof track.getCapabilities === 'function') {
          const caps: any = track.getCapabilities()

          if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
            setNativeZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 })
            setZoom(caps.zoom.min)
          }
          if (caps.torch) {
            setTorchSupported(true)
          }
          if (caps.pointsOfInterest || (Array.isArray(caps.focusMode) && caps.focusMode.includes('single-shot'))) {
            setTapFocusSupported(true)
          }
          // Best-effort: keep autofocus running continuously rather than locking after the
          // first shot, on devices that support it. Silently ignored where unsupported.
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            try {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] })
            } catch {
              // Ignore - not fatal, camera keeps whatever focus behaviour it already had.
            }
          }
        }

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
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    }
  }, [])

  function applyZoom(value: number) {
    setZoom(value)
    if (nativeZoomRange && trackRef.current) {
      trackRef.current.applyConstraints({ advanced: [{ zoom: value } as any] }).catch(() => {
        // Ignore - falls visually flat rather than crashing if the device rejects it mid-session.
      })
    }
  }

  async function toggleTorch() {
    if (!trackRef.current || !torchSupported) return
    const next = !torchOn
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as any] })
      setTorchOn(next)
    } catch {
      // Device claimed torch support but rejected the constraint - leave state unchanged.
    }
  }

  async function handleTapFocus(e: React.TouchEvent) {
    if (!tapFocusSupported || !trackRef.current || e.touches.length !== 1 || pinchStartRef.current) return
    const container = e.currentTarget.getBoundingClientRect()
    const touch = e.touches[0]
    const x = (touch.clientX - container.left) / container.width
    const y = (touch.clientY - container.top) / container.height

    setFocusPoint({ x: touch.clientX - container.left, y: touch.clientY - container.top })
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => setFocusPoint(null), 900)

    try {
      await trackRef.current.applyConstraints({
        advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x, y }] } as any],
      })
    } catch {
      // Unsupported combination on this device - the tap indicator still gives visual feedback.
    }
  }

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
    const range = nativeZoomRange || { min: DIGITAL_ZOOM_MIN, max: DIGITAL_ZOOM_MAX }
    const next = start.zoom * (distance / start.distance)
    applyZoom(Math.max(range.min, Math.min(range.max, next)))
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

    if (nativeZoomRange) {
      // The camera hardware/driver already zoomed the frame itself - what the video element
      // shows is exactly what to capture, no extra cropping needed.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    } else {
      // Digital fallback: crop to the same region the zoomed preview is showing (centred),
      // then scale back up to full resolution - the capture has to match what's on screen.
      const sw = video.videoWidth / zoom
      const sh = video.videoHeight / zoom
      const sx = (video.videoWidth - sw) / 2
      const sy = (video.videoHeight - sh) / 2
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    }

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

  const zoomRange = nativeZoomRange || { min: DIGITAL_ZOOM_MIN, max: DIGITAL_ZOOM_MAX, step: 0.1 }
  // Only scale the preview ourselves in the digital-zoom fallback - native zoom already
  // changes what the video element renders, so scaling it again would double the effect.
  const previewScale = nativeZoomRange ? 1 : zoom

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
            onTouchStart={(e) => {
              handleTouchStart(e)
              if (e.touches.length === 1) handleTapFocus(e)
            }}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: `scale(${previewScale})`, transformOrigin: 'center center' }}
            />

            {focusPoint && (
              <span
                className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-yellow-300"
                style={{ left: focusPoint.x, top: focusPoint.y }}
              />
            )}

            <div className="absolute left-3 top-3 flex gap-2">
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  aria-label="Toggle flash"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    torchOn ? 'bg-yellow-300 text-black' : 'bg-black/60 text-white'
                  }`}
                >
                  ⚡ {torchOn ? 'On' : 'Off'}
                </button>
              )}
            </div>

            {zoom > zoomRange.min && (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                {zoom.toFixed(1)}x
              </span>
            )}

            <div className="absolute bottom-4 right-3 flex h-40 items-center">
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoom}
                onChange={(e) => applyZoom(parseFloat(e.target.value))}
                className="h-40 w-8"
                style={{
                  writingMode: 'vertical-lr' as any,
                  direction: 'rtl',
                  touchAction: 'none',
                }}
                aria-label="Zoom"
              />
            </div>

            {tapFocusSupported && (
              <p className="pointer-events-none absolute bottom-4 left-3 max-w-[55%] text-[11px] text-white/70">
                Tap anywhere to focus
              </p>
            )}
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
