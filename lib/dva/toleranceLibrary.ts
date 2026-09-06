// Reference tolerance presets by element/system type, so entering a component
// doesn't require knowing a manufacturing or erection tolerance from memory.
//
// IMPORTANT: these are typical/indicative industry values for a first estimate,
// not a verified extract of any specific standard's clause. Always confirm the
// actual figure against the project specification, the manufacturer's tolerance
// data, or the applicable standard (e.g. BS EN 13369 for precast concrete,
// BS EN 1090-2 for structural steel fabrication) before relying on the result.

export interface TolerancePreset {
  id: string
  label: string
  category: string
  tolerancePlus: number
  toleranceMinus: number
  unit: 'mm'
  note: string
}

export const TOLERANCE_LIBRARY: TolerancePreset[] = [
  {
    id: 'precast-panel-manufacture',
    label: 'Precast concrete panel — manufacturing (length/width)',
    category: 'Precast concrete',
    tolerancePlus: 4,
    toleranceMinus: 4,
    unit: 'mm',
    note: 'Typical for panels up to ~6m — confirm against BS EN 13369 / the precaster’s own tolerance data for larger elements.',
  },
  {
    id: 'precast-panel-erection',
    label: 'Precast concrete panel — erection / setting-out',
    category: 'Precast concrete',
    tolerancePlus: 10,
    toleranceMinus: 10,
    unit: 'mm',
    note: 'Typical building setting-out tolerance — confirm against the project specification.',
  },
  {
    id: 'steel-member-fabrication',
    label: 'Structural steel member — fabrication length',
    category: 'Structural steel',
    tolerancePlus: 2,
    toleranceMinus: 2,
    unit: 'mm',
    note: 'Typical for short/medium members — confirm against BS EN 1090-2 fabrication class.',
  },
  {
    id: 'steel-frame-erection',
    label: 'Structural steel frame — erection / bay position',
    category: 'Structural steel',
    tolerancePlus: 6,
    toleranceMinus: 6,
    unit: 'mm',
    note: 'Typical steel erection tolerance — confirm against the project’s National Structural Steelwork Specification.',
  },
  {
    id: 'connection-packer',
    label: 'Connection / packer / shim allowance',
    category: 'Fixings & connections',
    tolerancePlus: 3,
    toleranceMinus: 3,
    unit: 'mm',
    note: 'Typical allowance for bolt-hole clearance and packing — confirm against the connection design.',
  },
  {
    id: 'curtainwall-panel-manufacture',
    label: 'Curtain wall panel — manufacturing',
    category: 'Curtain walling',
    tolerancePlus: 2,
    toleranceMinus: 2,
    unit: 'mm',
    note: 'Typical for factory-glazed unitised panels — confirm against the system manufacturer’s data.',
  },
  {
    id: 'cast-in-situ-concrete',
    label: 'Cast in-situ concrete — position / dimension',
    category: 'In-situ concrete',
    tolerancePlus: 12,
    toleranceMinus: 12,
    unit: 'mm',
    note: 'Typical formwork/placement tolerance — confirm against BS EN 13670 and the project specification.',
  },
]

export function findTolerancePreset(id: string): TolerancePreset | undefined {
  return TOLERANCE_LIBRARY.find((preset) => preset.id === id)
}

export function toleranceLibraryByCategory(): Map<string, TolerancePreset[]> {
  const byCategory = new Map<string, TolerancePreset[]>()
  for (const preset of TOLERANCE_LIBRARY) {
    const list = byCategory.get(preset.category) ?? []
    list.push(preset)
    byCategory.set(preset.category, list)
  }
  return byCategory
}
