export type Segment = {
  label: string
  value: number
  colorClass: string // Tailwind bg-* class for the fill
}

// A single full-width bar split into proportional segments, with a legend row
// underneath (swatch + label + count) - the part-to-whole chart this app uses
// instead of a donut. Segments below ~8% of the total skip their inline label
// (no room to set it without clipping) and rely on the legend instead.
export default function StackedBar({ segments, emptyLabel = 'No data yet' }: { segments: Segment[]; emptyLabel?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  if (total === 0) {
    return <p className="text-xs text-deck-dim">{emptyLabel}</p>
  }

  const visible = segments.filter((s) => s.value > 0)

  return (
    <div>
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full bg-deck-raised">
        {visible.map((s) => {
          const pct = (s.value / total) * 100
          return (
            <div
              key={s.label}
              className={`flex h-full items-center justify-center ${s.colorClass}`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.value} (${pct.toFixed(0)}%)`}
            >
              {pct >= 12 && (
                <span className="px-1 text-[10px] font-semibold text-white">{s.value}</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-deck-body">
            <span className={`h-2.5 w-2.5 rounded-full ${s.colorClass}`} />
            {s.label}
            <span className="text-deck-dim">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
