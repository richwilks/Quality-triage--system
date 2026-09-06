'use client'

import { DistributionType, JunctionComponent, StackUpSign } from '@/lib/dva/types'
import { findTolerancePreset, toleranceLibraryByCategory } from '@/lib/dva/toleranceLibrary'

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

export default function ComponentTable({
  components,
  onChange,
}: {
  components: JunctionComponent[]
  onChange: (components: JunctionComponent[]) => void
}) {
  function updateComponent(id: string, patch: Partial<JunctionComponent>) {
    onChange(components.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeComponent(id: string) {
    onChange(components.filter((c) => c.id !== id))
  }

  function applyPreset(id: string, presetId: string) {
    const preset = findTolerancePreset(presetId)
    if (!preset) return
    updateComponent(id, { tolerance_plus: preset.tolerancePlus, tolerance_minus: preset.toleranceMinus })
  }

  function addComponent() {
    const newComponent: JunctionComponent = {
      id: `component-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'New component',
      nominal_value: 0,
      tolerance_plus: 1,
      tolerance_minus: 1,
      distribution_type: 'normal',
      contributes_to: 'gap',
      sign: 1,
    }
    onChange([...components, newComponent])
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-deck-border">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-deck-border bg-deck-raised text-left text-xs font-semibold uppercase tracking-wide text-deck-dim">
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2">Tolerance preset</th>
              <th className="px-3 py-2">Nominal</th>
              <th className="px-3 py-2">Tol +</th>
              <th className="px-3 py-2">Tol −</th>
              <th className="px-3 py-2">Sign</th>
              <th className="px-3 py-2">Distribution</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c.id} className="border-b border-deck-border last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateComponent(c.id, { name: e.target.value })}
                    className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) applyPreset(c.id, e.target.value)
                      e.target.value = ''
                    }}
                    className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-xs text-deck-text"
                  >
                    <option value="">Apply preset…</option>
                    {Array.from(toleranceLibraryByCategory().entries()).map(([category, presets]) => (
                      <optgroup key={category} label={category}>
                        {presets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label} (±{preset.tolerancePlus}{preset.tolerancePlus === preset.toleranceMinus ? '' : `/-${preset.toleranceMinus}`}mm)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{numberInput(c.nominal_value, (v) => updateComponent(c.id, { nominal_value: v }))}</td>
                <td className="px-3 py-2">
                  {numberInput(c.tolerance_plus, (v) => updateComponent(c.id, { tolerance_plus: Math.abs(v) }), 0.5)}
                </td>
                <td className="px-3 py-2">
                  {numberInput(c.tolerance_minus, (v) => updateComponent(c.id, { tolerance_minus: Math.abs(v) }), 0.5)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={c.sign}
                    onChange={(e) => updateComponent(c.id, { sign: parseInt(e.target.value, 10) as StackUpSign })}
                    className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                  >
                    <option value={1}>+</option>
                    <option value={-1}>−</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={c.distribution_type}
                    onChange={(e) => updateComponent(c.id, { distribution_type: e.target.value as DistributionType })}
                    className="w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text"
                  >
                    <option value="normal">Normal</option>
                    <option value="uniform">Uniform</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeComponent(c.id)}
                    aria-label={`Remove ${c.name}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-status-rejected hover:bg-status-rejected/10"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addComponent}
        className="mt-3 rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium text-deck-body hover:bg-deck-raised"
      >
        + Add component
      </button>
    </div>
  )
}
