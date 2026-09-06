'use client'

import { Fixing } from '@/lib/dva/types'

function numberInput(value: number, onChange: (v: number) => void, step = 1) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
    />
  )
}

function multiSelectIds(options: HTMLCollectionOf<HTMLOptionElement>): string[] {
  return Array.from(options)
    .filter((o) => o.selected)
    .map((o) => o.value)
}

export default function FixingTable({
  fixings,
  onChange,
}: {
  fixings: Fixing[]
  onChange: (fixings: Fixing[]) => void
}) {
  function updateFixing(id: string, patch: Partial<Fixing>) {
    onChange(fixings.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function removeFixing(id: string) {
    onChange(
      fixings
        .filter((f) => f.id !== id)
        .map((f) => ({
          ...f,
          mustFollow: f.mustFollow.filter((depId) => depId !== id),
          mustPrecede: f.mustPrecede.filter((depId) => depId !== id),
        }))
    )
  }

  function addFixing() {
    const newFixing: Fixing = {
      id: `fixing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'New fixing',
      type: '',
      toolType: '',
      requiredClearance: 50,
      nominalAvailableClearance: 100,
      clearanceSensitivity: 0,
      oneSideAccessOnly: false,
      lineOfSightRequired: true,
      mustFollow: [],
      mustPrecede: [],
    }
    onChange([...fixings, newFixing])
  }

  if (fixings.length === 0) {
    return (
      <div>
        <p className="text-sm text-deck-dim">No fixings defined — this junction will only be checked dimensionally.</p>
        <button
          type="button"
          onClick={addFixing}
          className="mt-3 rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium text-deck-body hover:bg-deck-raised"
        >
          + Add fixing
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-deck-border">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-deck-border bg-deck-raised text-left text-xs font-semibold uppercase tracking-wide text-deck-dim">
              <th className="px-3 py-2">Fixing</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Tool</th>
              <th className="px-3 py-2">Required clearance</th>
              <th className="px-3 py-2">Available at nominal</th>
              <th className="px-3 py-2">Sensitivity</th>
              <th className="px-3 py-2">Must follow</th>
              <th className="px-3 py-2">Must precede</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {fixings.map((f) => {
              const otherFixings = fixings.filter((other) => other.id !== f.id)
              return (
                <tr key={f.id} className="border-b border-deck-border align-top last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => updateFixing(f.id, { name: e.target.value })}
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                    />
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-deck-dim">
                      <input
                        type="checkbox"
                        checked={f.oneSideAccessOnly}
                        onChange={(e) => updateFixing(f.id, { oneSideAccessOnly: e.target.checked })}
                      />
                      One-side access only
                    </label>
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-deck-dim">
                      <input
                        type="checkbox"
                        checked={f.lineOfSightRequired}
                        onChange={(e) => updateFixing(f.id, { lineOfSightRequired: e.target.checked })}
                      />
                      Line of sight required
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={f.type}
                      onChange={(e) => updateFixing(f.id, { type: e.target.value })}
                      placeholder="e.g. M12 bolt"
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={f.toolType}
                      onChange={(e) => updateFixing(f.id, { toolType: e.target.value })}
                      placeholder="e.g. torque wrench"
                      className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-2">{numberInput(f.requiredClearance, (v) => updateFixing(f.id, { requiredClearance: Math.abs(v) }), 5)}</td>
                  <td className="px-3 py-2">
                    {numberInput(f.nominalAvailableClearance, (v) => updateFixing(f.id, { nominalAvailableClearance: Math.abs(v) }), 5)}
                  </td>
                  <td className="px-3 py-2">{numberInput(f.clearanceSensitivity, (v) => updateFixing(f.id, { clearanceSensitivity: v }), 0.5)}</td>
                  <td className="px-3 py-2">
                    <select
                      multiple
                      size={Math.min(3, Math.max(1, otherFixings.length))}
                      value={f.mustFollow}
                      onChange={(e) => updateFixing(f.id, { mustFollow: multiSelectIds(e.target.options) })}
                      className="w-full min-w-[130px] rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-xs text-deck-text"
                    >
                      {otherFixings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      multiple
                      size={Math.min(3, Math.max(1, otherFixings.length))}
                      value={f.mustPrecede}
                      onChange={(e) => updateFixing(f.id, { mustPrecede: multiSelectIds(e.target.options) })}
                      className="w-full min-w-[130px] rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-xs text-deck-text"
                    >
                      {otherFixings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeFixing(f.id)}
                      aria-label={`Remove ${f.name}`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-status-rejected hover:bg-status-rejected/10"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addFixing}
        className="mt-3 rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium text-deck-body hover:bg-deck-raised"
      >
        + Add fixing
      </button>
    </div>
  )
}
