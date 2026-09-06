'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { JunctionComponent, StackUpSign } from '@/lib/dva/types'
import { PickedElement } from '@/lib/dva/ifc/ifcLoader'
import { BoundsAxis, componentFromPickedElement } from '@/lib/dva/ifc/mapping'
import { toleranceLibraryByCategory } from '@/lib/dva/toleranceLibrary'

// web-ifc and three.js are browser-only (WASM + WebGL) — never render this on the server.
const IfcViewer = dynamic(() => import('./IfcViewer'), {
  ssr: false,
  loading: () => <p className="mt-3 text-sm text-deck-dim">Loading 3D viewer…</p>,
})

export default function IfcImportPanel({ onAddComponent }: { onAddComponent: (component: JunctionComponent) => void }) {
  const [picked, setPicked] = useState<PickedElement | null>(null)
  const [axis, setAxis] = useState<BoundsAxis>('width')
  const [sign, setSign] = useState<StackUpSign>(1)
  const [presetId, setPresetId] = useState('')
  const [name, setName] = useState('')

  function handlePicked(element: PickedElement) {
    setPicked(element)
    setName(element.name)
    setAxis('width')
  }

  function addComponent() {
    if (!picked) return
    const component = componentFromPickedElement({
      id: `component-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || picked.name,
      bounds: picked.bounds,
      axis,
      sign,
      tolerancePresetId: presetId || undefined,
    })
    onAddComponent(component)
    setPicked(null)
  }

  return (
    <div>
      <p className="text-xs text-deck-dim">
        Upload an IFC file exported from your BIM tool, click an element to select it, then add its real dimension
        as a component below — no retyping numbers from the drawing.
      </p>

      <div className="mt-3">
        <IfcViewer onElementPicked={handlePicked} />
      </div>

      {picked && (
        <div className="mt-4 rounded-lg border border-deck-border bg-deck-raised p-4">
          <p className="text-sm font-semibold text-deck-text">
            {picked.name} <span className="font-normal text-deck-dim">({picked.ifcType})</span>
          </p>
          <p className="mt-1 text-xs text-deck-dim">
            Bounding-box extents — a first estimate read from the model geometry, not a substitute for the actual
            dimensioned drawing on critical members.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-deck-body">
              Component name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
              />
            </label>

            <label className="text-sm text-deck-body">
              Dimension to use as nominal value
              <select
                value={axis}
                onChange={(e) => setAxis(e.target.value as BoundsAxis)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
              >
                <option value="width">Width (X): {picked.bounds.width.toFixed(0)} mm</option>
                <option value="height">Height (Y): {picked.bounds.height.toFixed(0)} mm</option>
                <option value="depth">Depth (Z): {picked.bounds.depth.toFixed(0)} mm</option>
              </select>
            </label>

            <label className="text-sm text-deck-body">
              Sign
              <select
                value={sign}
                onChange={(e) => setSign(parseInt(e.target.value, 10) as StackUpSign)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
              >
                <option value={1}>+</option>
                <option value={-1}>−</option>
              </select>
            </label>

            <label className="text-sm text-deck-body">
              Tolerance preset
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
              >
                <option value="">None (default ±1mm — set manually after adding)</option>
                {Array.from(toleranceLibraryByCategory().entries()).map(([category, presets]) => (
                  <optgroup key={category} label={category}>
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} (±{preset.tolerancePlus}mm)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={addComponent}
              className="rounded-md bg-deck-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Add as component
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body hover:bg-deck-raised"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
