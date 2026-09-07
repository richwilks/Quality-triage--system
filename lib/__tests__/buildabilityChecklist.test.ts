import { describe, expect, it } from 'vitest'
import {
  BUILDABILITY_CATEGORY_LABELS,
  BUILDABILITY_CHECKLIST,
  buildabilityChecklistByCategory,
  buildabilityItemByKey,
} from '../buildabilityChecklist'

describe('buildability checklist', () => {
  it('has unique keys and non-empty label/guidance for every item', () => {
    const keys = new Set<string>()
    for (const item of BUILDABILITY_CHECKLIST) {
      expect(keys.has(item.key)).toBe(false)
      keys.add(item.key)
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.guidance.length).toBeGreaterThan(0)
    }
  })

  it('assigns every item a category that has a display label', () => {
    for (const item of BUILDABILITY_CHECKLIST) {
      expect(BUILDABILITY_CATEGORY_LABELS[item.category]).toBeTruthy()
    }
  })

  it('finds an item by key', () => {
    const item = buildabilityItemByKey('crane_reach_lift_weight')
    expect(item?.category).toBe('access_lifting')
  })

  it('returns undefined for an unknown key', () => {
    expect(buildabilityItemByKey('does-not-exist')).toBeUndefined()
  })

  it('groups every item by category exactly once', () => {
    const grouped = buildabilityChecklistByCategory()
    const total = Array.from(grouped.values()).reduce((sum, list) => sum + list.length, 0)
    expect(total).toBe(BUILDABILITY_CHECKLIST.length)
  })
})
