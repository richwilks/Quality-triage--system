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
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

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

  function handleShutter() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
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
          <video ref={videoRef} playsInline muted className="w-full flex-1 object-cover" />
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
