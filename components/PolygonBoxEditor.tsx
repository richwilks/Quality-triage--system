'use client'

import { useRef } from 'react'

export type Point = { x: number; y: number }

// Renders an editable polygon overlay (percentage coordinates, 0-100, matching the
// existing bounding_box convention) on top of a positioned image container.
// - Drag a point handle to move it.
// - Double-click/double-tap a point handle to remove it (minimum 3 points).
// - Click/tap an edge to insert a new point there.
export default function PolygonBoxEditor({
  points,
  onChange,
  color = '#ef4444',
}: {
  points: Point[]
  onChange: (points: Point[]) => void
  color?: string
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragIndexRef = useRef<number | null>(null)

  function percentFromEvent(e: { clientX: number; clientY: number }): Point {
    const el = wrapperRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  function handlePointDown(e: React.PointerEvent, index: number) {
    e.preventDefault()
    e.stopPropagation()
    dragIndexRef.current = index
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointMove(e: React.PointerEvent) {
    const index = dragIndexRef.current
    if (index === null) return
    e.stopPropagation()
    const p = percentFromEvent(e)
    onChange(points.map((pt, i) => (i === index ? p : pt)))
  }

  function handlePointUp() {
    dragIndexRef.current = null
  }

  function handleRemovePoint(index: number) {
    if (points.length <= 3) return
    onChange(points.filter((_, i) => i !== index))
  }

  function handleEdgeClick(e: React.MouseEvent, afterIndex: number) {
    e.stopPropagation()
    const p = percentFromEvent(e)
    onChange([...points.slice(0, afterIndex + 1), p, ...points.slice(afterIndex + 1)])
  }

  const pointsAttr = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div ref={wrapperRef} className="absolute inset-0" style={{ touchAction: 'none' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polygon points={pointsAttr} fill={color} fillOpacity={0.15} stroke="none" />
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length]
          return (
            <line
              key={i}
              x1={p.x}
              y1={p.y}
              x2={next.x}
              y2={next.y}
              stroke={color}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'copy', pointerEvents: 'stroke' }}
              onClick={(e) => handleEdgeClick(e, i)}
            />
          )
        })}
      </svg>
      <span className="absolute -top-6 left-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Drag points - tap an edge to add, double-tap a point to remove
      </span>
      {points.map((p, i) => (
        <div
          key={i}
          onPointerDown={(e) => handlePointDown(e, i)}
          onPointerMove={handlePointMove}
          onPointerUp={handlePointUp}
          onDoubleClick={() => handleRemovePoint(i)}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 18,
            height: 18,
            marginLeft: -9,
            marginTop: -9,
            borderRadius: '50%',
            backgroundColor: color,
            border: '2px solid white',
            cursor: 'grab',
            touchAction: 'none',
          }}
        />
      ))}
    </div>
  )
}
