export type MonthlyCount = { monthLabel: string; open: number; closed: number }

// A simple grouped column chart: one pair of thin bars per month (opened vs
// closed), sharing one scale. Matches StackedBar's convention - native title
// tooltips, a swatch legend below - rather than a separate tooltip mechanism.
export default function MonthlyOpenClosedBar({ data }: { data: MonthlyCount[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.open, d.closed)))
  const totalOpen = data.reduce((sum, d) => sum + d.open, 0)
  const totalClosed = data.reduce((sum, d) => sum + d.closed, 0)

  if (totalOpen === 0 && totalClosed === 0) {
    return <p className="text-xs text-deck-dim">No tasks assigned to you yet.</p>
  }

  return (
    <div>
      <div className="flex h-28 items-end gap-3">
        {data.map((d) => (
          <div key={d.monthLabel} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 items-end gap-0.5">
              <div
                title={`${d.monthLabel} opened: ${d.open}`}
                className="w-2.5 rounded-t bg-status-assigned sm:w-3"
                style={{ height: `${Math.max(2, (d.open / max) * 100)}%` }}
              />
              <div
                title={`${d.monthLabel} closed: ${d.closed}`}
                className="w-2.5 rounded-t bg-status-closed sm:w-3"
                style={{ height: `${Math.max(2, (d.closed / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-deck-mute">{d.monthLabel}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5 text-xs text-deck-body">
          <span className="h-2.5 w-2.5 rounded-full bg-status-assigned" />
          Opened
          <span className="text-deck-dim">{totalOpen}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-deck-body">
          <span className="h-2.5 w-2.5 rounded-full bg-status-closed" />
          Closed
          <span className="text-deck-dim">{totalClosed}</span>
        </div>
      </div>
    </div>
  )
}
