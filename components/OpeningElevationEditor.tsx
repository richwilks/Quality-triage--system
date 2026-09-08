'use client'

// A simple front-on elevation diagram for one door or window opening - not a
// projection of the real wall (this app has no wall-height model), just a
// self-contained, to-scale rectangle so width/height/sill can be set by eye
// rather than blind into a form, the same idea as tapping two points for an
// as-built dimension instead of typing a raw number with no visual reference.
const NOMINAL_CEILING_MM = 2700

export default function OpeningElevationEditor({
  type,
  widthMm,
  heightMm,
  sillMm,
  onWidthChange,
  onHeightChange,
  onSillChange,
}: {
  type: 'door' | 'window'
  widthMm: number
  heightMm: number
  sillMm: number
  onWidthChange: (mm: number) => void
  onHeightChange: (mm: number) => void
  onSillChange: (mm: number) => void
}) {
  const wallWidthMm = Math.max(widthMm * 1.6, 2200)
  const scale = 100 / NOMINAL_CEILING_MM
  const panelW = wallWidthMm * scale
  const panelH = 100

  const openingW = widthMm * scale
  const openingH = heightMm * scale
  const openingX = (panelW - openingW) / 2
  const sill = type === 'window' ? sillMm : 0
  const openingBottomFromFloor = sill * scale
  const openingY = panelH - openingBottomFromFloor - openingH

  return (
    <div>
      <svg
        viewBox={`0 0 ${panelW} ${panelH}`}
        className="w-full rounded-md border border-deck-border bg-deck-raised"
        style={{ height: 140 }}
      >
        <rect x={0} y={0} width={panelW} height={panelH} fill="#ECE9E1" />
        <rect
          x={openingX}
          y={Math.max(0, openingY)}
          width={openingW}
          height={Math.min(openingH, panelH - openingBottomFromFloor)}
          fill={type === 'door' ? '#FFFFFF' : '#BEE3E8'}
          stroke="#1F565C"
          strokeWidth={1}
        />
        {type === 'window' && (
          <line
            x1={openingX}
            y1={Math.max(0, openingY) + Math.min(openingH, panelH - openingBottomFromFloor) / 2}
            x2={openingX + openingW}
            y2={Math.max(0, openingY) + Math.min(openingH, panelH - openingBottomFromFloor) / 2}
            stroke="#1F565C"
            strokeWidth={1}
          />
        )}
        <line x1={0} y1={panelH - 0.5} x2={panelW} y2={panelH - 0.5} stroke="#767162" strokeWidth={1} />
      </svg>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-deck-body">Width (mm)</label>
          <input
            type="number"
            inputMode="numeric"
            value={widthMm}
            onChange={(e) => onWidthChange(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-deck-body">Height (mm)</label>
          <input
            type="number"
            inputMode="numeric"
            value={heightMm}
            onChange={(e) => onHeightChange(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
          />
        </div>
        {type === 'window' && (
          <div>
            <label className="block text-xs font-medium text-deck-body">Sill height (mm)</label>
            <input
              type="number"
              inputMode="numeric"
              value={sillMm}
              onChange={(e) => onSillChange(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
            />
          </div>
        )}
      </div>
    </div>
  )
}
