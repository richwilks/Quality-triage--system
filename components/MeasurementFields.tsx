'use client'

export type MeasurementData = {
  measuredGapMm: string
  testedDetailReference: string
  manufacturerSystem: string
}

export default function MeasurementFields({
  data,
  onChange,
}: {
  data: MeasurementData
  onChange: (patch: Partial<MeasurementData>) => void
}) {
  return (
    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-700">
        Manual measurement required - this cannot be measured from a photo
      </p>
      <label className="mt-2 block text-xs font-medium text-deck-body">Measured gap (mm)</label>
      <input
        type="number"
        value={data.measuredGapMm}
        onChange={(e) => onChange({ measuredGapMm: e.target.value })}
        placeholder="e.g. 15"
        className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
      />
      <label className="mt-2 block text-xs font-medium text-deck-body">Tested detail reference</label>
      <input
        type="text"
        value={data.testedDetailReference}
        onChange={(e) => onChange({ testedDetailReference: e.target.value })}
        placeholder="e.g. Promat FS-123, or manufacturer's test cert number"
        className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
      />
      <label className="mt-2 block text-xs font-medium text-deck-body">Manufacturer / system</label>
      <input
        type="text"
        value={data.manufacturerSystem}
        onChange={(e) => onChange({ manufacturerSystem: e.target.value })}
        placeholder="e.g. Hilti CFS system"
        className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1.5 text-sm text-deck-text placeholder:text-deck-mute"
      />
    </div>
  )
}

