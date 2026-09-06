import { describe, expect, it } from 'vitest'
import { IFCPROJECT, IFCSIUNIT } from 'web-ifc'
import type { IfcAPI } from 'web-ifc'
import { detectLengthUnit } from '../units'

// A minimal stand-in for IfcAPI covering just the methods detectLengthUnit calls,
// modelling the IFCPROJECT -> UnitsInContext -> IFCUNITASSIGNMENT -> Units[] chain
// a real IFC file expresses its length unit through.
function fakeApi(lines: Record<number, any>, lineTypes: Record<number, number>, projectIds: number[]): IfcAPI {
  return {
    GetLineIDsWithType: () => ({ size: () => projectIds.length, get: (i: number) => projectIds[i] }),
    GetLine: (_modelID: number, expressID: number) => lines[expressID],
    GetLineType: (_modelID: number, expressID: number) => lineTypes[expressID],
  } as unknown as IfcAPI
}

describe('detectLengthUnit', () => {
  it('reads a millimetre IfcSIUnit through the full IFCPROJECT -> units chain', () => {
    const api = fakeApi(
      {
        1: { UnitsInContext: { value: 2 } },
        2: {
          Units: [{ value: 3 }, { value: 4 }],
        },
        3: { UnitType: { value: 'AREAUNIT' } }, // a non-length unit that should be skipped
        4: { UnitType: { value: 'LENGTHUNIT' }, Name: { value: 'METRE' }, Prefix: { value: 'MILLI' } },
      },
      { 4: IFCSIUNIT, 3: IFCSIUNIT },
      [1]
    )

    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(true)
    expect(result.scaleToMm).toBe(1)
    expect(result.label).toBe('milli metre')
  })

  it('treats a plain metre unit (no prefix) as scale 1000 to mm', () => {
    const api = fakeApi(
      {
        1: { UnitsInContext: { value: 2 } },
        2: { Units: [{ value: 3 }] },
        3: { UnitType: { value: 'LENGTHUNIT' }, Name: { value: 'METRE' } },
      },
      { 3: IFCSIUNIT },
      [1]
    )

    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(true)
    expect(result.scaleToMm).toBe(1000)
  })

  it('falls back to assumed metres when there is no IFCPROJECT', () => {
    const api = fakeApi({}, {}, [])
    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(false)
    expect(result.scaleToMm).toBe(1000)
  })

  it('falls back to assumed metres when UnitsInContext is missing', () => {
    const api = fakeApi({ 1: {} }, {}, [1])
    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(false)
  })

  it('falls back to assumed metres when no LENGTHUNIT is present among the units', () => {
    const api = fakeApi(
      {
        1: { UnitsInContext: { value: 2 } },
        2: { Units: [{ value: 3 }] },
        3: { UnitType: { value: 'AREAUNIT' } },
      },
      { 3: IFCSIUNIT },
      [1]
    )
    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(false)
    expect(result.scaleToMm).toBe(1000)
  })

  it('falls back gracefully if a lookup throws', () => {
    const api = {
      GetLineIDsWithType: () => {
        throw new Error('boom')
      },
    } as unknown as IfcAPI
    const result = detectLengthUnit(api, 0)
    expect(result.detected).toBe(false)
    expect(result.scaleToMm).toBe(1000)
  })
})
