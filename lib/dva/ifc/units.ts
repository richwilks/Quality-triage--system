// Detects the IFC model's own length unit and returns a scale factor to
// millimetres, since every other part of this tool (tolerance library,
// calculation engine, requirement bounds) works in mm. IFC files commonly
// declare metres as the base length unit (a common Revit/ArchiCAD/Tekla
// export setting) — without this, a component's extracted dimension would
// silently be out by a factor of 1000.
//
// Best-effort: real IFC files vary in how thoroughly they populate this, and
// the exact shape of web-ifc's GetLine() attribute wrappers isn't something
// this environment can verify against a real file. On any unexpected shape
// or missing data, this falls back to assuming metres (the IFC/buildingSMART
// base convention) rather than throwing — but callers should surface
// detectedUnit.label to the user so a wrong guess is visible, not silent.

import { IFCPROJECT, IFCSIUNIT } from 'web-ifc'
import type { IfcAPI } from 'web-ifc'

const SI_PREFIX_SCALE: Record<string, number> = {
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
}

export interface DetectedLengthUnit {
  /** Multiply a raw model-space distance by this to get millimetres. */
  scaleToMm: number
  label: string
  /** False when this is a fallback guess, not something read from the file. */
  detected: boolean
}

const ASSUMED_METRES: DetectedLengthUnit = { scaleToMm: 1000, label: 'metres (assumed — not found in file)', detected: false }

function attrValue(attr: unknown): unknown {
  return attr && typeof attr === 'object' && 'value' in (attr as Record<string, unknown>)
    ? (attr as Record<string, unknown>).value
    : attr
}

export function detectLengthUnit(api: IfcAPI, modelID: number): DetectedLengthUnit {
  try {
    const projectIds = api.GetLineIDsWithType(modelID, IFCPROJECT)
    if (projectIds.size() === 0) return ASSUMED_METRES

    const project = api.GetLine(modelID, projectIds.get(0))
    const unitsRef = attrValue(project.UnitsInContext)
    if (typeof unitsRef !== 'number') return ASSUMED_METRES

    const unitAssignment = api.GetLine(modelID, unitsRef)
    const unitHandles: unknown[] = Array.isArray(unitAssignment.Units) ? unitAssignment.Units : []

    for (const handle of unitHandles) {
      const unitRef = attrValue(handle)
      if (typeof unitRef !== 'number') continue

      const unit = api.GetLine(modelID, unitRef)
      if (attrValue(unit.UnitType) !== 'LENGTHUNIT') continue

      // IfcSIUnit is the common case; IfcConversionBasedUnit (e.g. feet/inches) isn't handled here.
      const unitLine = api.GetLineType(modelID, unitRef) === IFCSIUNIT ? unit : null
      if (!unitLine) return ASSUMED_METRES

      const name = attrValue(unitLine.Name)
      const prefix = attrValue(unitLine.Prefix)
      if (typeof name !== 'string') return ASSUMED_METRES

      const prefixScale = typeof prefix === 'string' ? SI_PREFIX_SCALE[prefix] : 1
      if (prefixScale === undefined) return ASSUMED_METRES

      const scaleToMm = prefixScale * 1000
      const label = `${typeof prefix === 'string' ? prefix.toLowerCase() + ' ' : ''}${name.toLowerCase()}`
      return { scaleToMm, label, detected: true }
    }

    return ASSUMED_METRES
  } catch {
    return ASSUMED_METRES
  }
}
