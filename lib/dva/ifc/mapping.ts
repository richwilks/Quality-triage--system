// Pure mapping logic from a picked model element's extracted geometry to a
// JunctionComponent — kept free of three.js/web-ifc imports so it's unit
// testable without a WebGL context. The 3D-specific code (ifcLoader.ts,
// IfcViewer.tsx) calls into this once it has real bounding-box numbers.

import { DistributionType, JunctionComponent, StackUpSign } from '../types'
import { findTolerancePreset } from '../toleranceLibrary'

export interface PickedElementBounds {
  /** World-space bounding-box extents, mm, one per axis. */
  width: number // X
  height: number // Y
  depth: number // Z
}

export type BoundsAxis = 'width' | 'height' | 'depth'

export function componentFromPickedElement(params: {
  id: string
  name: string
  bounds: PickedElementBounds
  axis: BoundsAxis
  sign: StackUpSign
  tolerancePresetId?: string
  distribution_type?: DistributionType
}): JunctionComponent {
  const preset = params.tolerancePresetId ? findTolerancePreset(params.tolerancePresetId) : undefined

  return {
    id: params.id,
    name: params.name,
    nominal_value: Math.round(params.bounds[params.axis] * 100) / 100,
    tolerance_plus: preset?.tolerancePlus ?? 1,
    tolerance_minus: preset?.toleranceMinus ?? 1,
    distribution_type: params.distribution_type ?? 'normal',
    contributes_to: 'gap',
    sign: params.sign,
  }
}
