import { DominantDriver } from '@/lib/dva/types'

export default function DominantDriverCallout({ drivers }: { drivers: DominantDriver[] }) {
  if (drivers.length === 0) {
    return (
      <p className="text-sm text-deck-body">No failing runs — there is no dominant driver to report.</p>
    )
  }

  const top = drivers[0]

  return (
    <div>
      <p className="text-sm text-deck-text">
        <span className="font-semibold">{top.componentName}</span> was the largest contributor in{' '}
        <span className="font-semibold">{Math.round(top.failingRunShare * 100)}%</span> of failing runs — start
        tightening tolerances there.
      </p>
      {drivers.length > 1 && (
        <ul className="mt-2 space-y-1 text-xs text-deck-dim">
          {drivers.slice(1, 4).map((d) => (
            <li key={d.componentId}>
              {d.componentName}: {Math.round(d.failingRunShare * 100)}% of failing runs
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
