export type BarRow = {
  key: string
  label: string
  value: number
  colorClass: string // Tailwind bg-* class for the fill
  formatValue?: (value: number) => string
}

// Ranked horizontal bars - one row per project/company - each bar's length
// relative to the largest value in the list so rows are comparable at a glance.
export default function BarList({ rows, emptyLabel = 'No data yet' }: { rows: BarRow[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return <p className="text-xs text-deck-dim">{emptyLabel}</p>
  }

  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)
        const display = r.formatValue ? r.formatValue(r.value) : String(r.value)
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium text-deck-body">{r.label}</span>
              <span className="shrink-0 text-xs font-semibold text-deck-text">{display}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-deck-raised">
              <div className={`h-full rounded-full ${r.colorClass}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
