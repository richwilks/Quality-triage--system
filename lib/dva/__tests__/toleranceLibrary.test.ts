import { describe, expect, it } from 'vitest'
import { findTolerancePreset, toleranceLibraryByCategory, TOLERANCE_LIBRARY } from '../toleranceLibrary'

describe('tolerance library', () => {
  it('has unique, non-negative ids and tolerances for every preset', () => {
    const ids = new Set<string>()
    for (const preset of TOLERANCE_LIBRARY) {
      expect(ids.has(preset.id)).toBe(false)
      ids.add(preset.id)
      expect(preset.tolerancePlus).toBeGreaterThan(0)
      expect(preset.toleranceMinus).toBeGreaterThan(0)
    }
  })

  it('finds a preset by id', () => {
    const preset = findTolerancePreset('precast-panel-manufacture')
    expect(preset?.category).toBe('Precast concrete')
    expect(preset?.tolerancePlus).toBe(4)
  })

  it('returns undefined for an unknown id', () => {
    expect(findTolerancePreset('does-not-exist')).toBeUndefined()
  })

  it('groups presets by category, covering every preset exactly once', () => {
    const grouped = toleranceLibraryByCategory()
    const total = Array.from(grouped.values()).reduce((sum, list) => sum + list.length, 0)
    expect(total).toBe(TOLERANCE_LIBRARY.length)
  })
})
