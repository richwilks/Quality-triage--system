import { describe, expect, it } from 'vitest'
import { createEvidenceRecord, evidenceRecordToJson } from '../evidenceLog'
import { createPrecastPanelToSteelFramePreset } from '../presets'
import { runStackUp } from '../calculationEngine'

describe('createEvidenceRecord', () => {
  it('captures the method, junction, result and a timestamp', () => {
    const junction = createPrecastPanelToSteelFramePreset()
    const stackUp = runStackUp(junction)

    const record = createEvidenceRecord({
      method: 'worst-case-rss',
      junction,
      overallFlag: stackUp.overallFlag,
      stackUp,
    })

    expect(record.id).toMatch(/^evidence-/)
    expect(new Date(record.createdAt).toString()).not.toBe('Invalid Date')
    expect(record.method).toBe('worst-case-rss')
    expect(record.junction).toEqual(junction)
    expect(record.overallFlag).toBe(stackUp.overallFlag)
    expect(record.monteCarloSummary).toBeUndefined()
  })

  it('round-trips cleanly through JSON', () => {
    const junction = createPrecastPanelToSteelFramePreset()
    const stackUp = runStackUp(junction)
    const record = createEvidenceRecord({ method: 'worst-case-rss', junction, overallFlag: stackUp.overallFlag, stackUp })

    const parsed = JSON.parse(evidenceRecordToJson(record))
    expect(parsed.id).toBe(record.id)
    expect(parsed.junction.id).toBe(junction.id)
    expect(parsed.stackUp.nominal).toBe(stackUp.nominal)
  })
})
