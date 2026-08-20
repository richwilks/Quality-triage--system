export default function CopsefieldBar({
  label,
  count,
  max,
  colorClass,
}: {
  label: string
  count: number
  max: number
  colorClass: string
}) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 truncate text-xs text-deck-dim">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-deck-raised">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-medium text-deck-body">{count}</span>
    </div>
  )
}
