'use client'

import { useEffect, useRef, useState } from 'react'

// Web Bluetooth only exists on Chromium-based browsers (Chrome/Edge on
// Android and desktop) - Safari has no Bluetooth API at all, on iOS or
// macOS, by Apple's own design, so this component renders nothing there
// rather than showing a button that can never work.
//
// There's no single standard protocol across laser distance meter brands.
// This targets Leica DISTO's published Bluetooth Smart API (used by D2,
// D110, D510, X3/X4 and similar BLE-capable models): a GATT service that
// notifies the live displayed reading as a little-endian 32-bit float in
// metres. Older/serial-only DISTO models and other manufacturers (Bosch
// GLM, etc.) are not covered - connecting will simply fail to find this
// service on an incompatible device rather than report a wrong number.
const DISTO_SERVICE_UUID = '3ab10100-f831-4395-b29d-570977d5bfac'
const DISTO_DISTANCE_CHARACTERISTIC_UUID = '3ab10101-f831-4395-b29d-570977d5bfac'

type ConnState = 'idle' | 'connecting' | 'connected' | 'error'

export default function DistoConnect({ onUseReading }: { onUseReading: (valueMm: number) => void }) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<ConnState>('idle')
  const [liveMm, setLiveMm] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deviceRef = useRef<any>(null)

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && !!(navigator as any).bluetooth)
    return () => {
      try {
        deviceRef.current?.gatt?.disconnect()
      } catch {
        // ignore - best-effort cleanup on unmount
      }
    }
  }, [])

  async function handleConnect() {
    setState('connecting')
    setError(null)
    try {
      const bluetooth = (navigator as any).bluetooth
      const device = await bluetooth.requestDevice({
        filters: [{ services: [DISTO_SERVICE_UUID] }],
      })
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', () => {
        setState('idle')
        setLiveMm(null)
      })

      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(DISTO_SERVICE_UUID)
      const characteristic = await service.getCharacteristic(DISTO_DISTANCE_CHARACTERISTIC_UUID)

      await characteristic.startNotifications()
      characteristic.addEventListener('characteristicvaluechanged', (e: any) => {
        const dataView: DataView = e.target.value
        if (dataView.byteLength < 4) return
        const meters = dataView.getFloat32(0, /* littleEndian */ true)
        if (!isFinite(meters) || meters <= 0) return
        setLiveMm(Math.round(meters * 1000))
      })

      setState('connected')
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        // User cancelled the device chooser - not an error worth surfacing.
        setState('idle')
        return
      }
      setState('error')
      setError(
        err?.message?.includes('GATT')
          ? "Connected, but couldn't find a Leica DISTO measurement service on that device - this currently only supports Leica DISTO Bluetooth models."
          : `Couldn't connect: ${err?.message || 'unknown error'}`
      )
    }
  }

  function handleDisconnect() {
    deviceRef.current?.gatt?.disconnect()
    setState('idle')
    setLiveMm(null)
  }

  if (!supported) return null

  return (
    <div className="mt-3 rounded-lg border border-deck-border bg-deck-raised p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">Laser meter (Bluetooth)</p>

      {state === 'idle' && (
        <button
          onClick={handleConnect}
          className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm font-medium text-deck-body"
        >
          Connect laser meter
        </button>
      )}

      {state === 'connecting' && <p className="mt-2 text-sm text-deck-dim">Opening device chooser...</p>}

      {state === 'error' && (
        <>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            onClick={handleConnect}
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm font-medium text-deck-body"
          >
            Try again
          </button>
        </>
      )}

      {state === 'connected' && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-sm text-deck-body">
              {liveMm !== null ? (
                <>
                  Live reading: <span className="font-semibold text-deck-text">{liveMm} mm</span> (
                  {(liveMm / 1000).toFixed(3)} m)
                </>
              ) : (
                'Connected - waiting for a measurement...'
              )}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => liveMm !== null && onUseReading(liveMm)}
              disabled={liveMm === null}
              className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              Use this reading
            </button>
            <button
              onClick={handleDisconnect}
              className="flex-1 rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm font-medium text-deck-body"
            >
              Disconnect
            </button>
          </div>
          <p className="mt-2 text-[11px] text-deck-mute">
            Take the measurement on the device itself, then tap "Use this reading" - it fills the value box below for
            you to check before saving, it doesn't save automatically.
          </p>
        </>
      )}
    </div>
  )
}
