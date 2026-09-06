// Data model for Dimensional Variation Analysis (DVA), per the MVP build brief.
// Framework-agnostic: no React/UI imports belong in this file.

export type DistributionType = 'normal' | 'uniform'

export type ContributesTo =
  | 'gap'
  | 'position_x'
  | 'position_y'
  | 'position_z'
  | 'rotation'

export type StackUpSign = 1 | -1

export interface Geometry3D {
  width: number
  height: number
  depth: number
  position_nominal: { x: number; y: number; z: number }
}

export interface JunctionComponent {
  id: string
  name: string
  nominal_value: number
  /** Positive-side tolerance, e.g. 3 for "+3mm". Always >= 0. */
  tolerance_plus: number
  /** Negative-side tolerance, e.g. 3 for "-3mm". Always >= 0. */
  tolerance_minus: number
  distribution_type: DistributionType
  contributes_to: ContributesTo
  /** Sign this component's variation contributes with, toward the requirement. */
  sign: StackUpSign
  /** Stretch: 3D geometry, only used by the (not-yet-built) full 3D mode. */
  geometry?: Geometry3D
}

export interface JunctionRequirement {
  parameter: string
  acceptable_min: number
  acceptable_max: number
  unit: string
}

export interface Junction {
  id: string
  name: string
  type: string
  requirement: JunctionRequirement
  components: JunctionComponent[]
  /** Fixings that must physically be installed at this junction — the buildability layer (see fixingAccess.ts). */
  fixings?: Fixing[]
}

export type ResultFlag = 'pass' | 'at-risk' | 'fail'

export interface StackUpEngineResult {
  nominal: number
  worstCase: { min: number; max: number; totalTolerance: number }
  rss: { min: number; max: number; totalTolerance: number }
  worstCaseFlag: ResultFlag
  rssFlag: ResultFlag
  overallFlag: ResultFlag
}

export interface DominantDriver {
  componentId: string
  componentName: string
  failingRunShare: number // 0..1, fraction of failing runs this component was the largest contributor in
}

export interface MonteCarloSample {
  outcome: number
  pass: boolean
  /** Which component was furthest from its own nominal, as a fraction of its own tolerance, on this run. */
  largestContributorId: string
}

export interface MonteCarloEngineResult {
  runs: number
  outcomes: number[]
  failCount: number
  failRate: number // 0..1
  mean: number
  stdDev: number
  min: number
  max: number
  dominantDrivers: DominantDriver[]
  flag: ResultFlag
}

/** At-risk band as a fraction of the requirement's own width, applied inward from each acceptable bound. */
export const AT_RISK_MARGIN_FRACTION = 0.1

// --- Fixing & installation buildability (DVA addendum) ---
// A junction can pass the dimensional stack-up and still fail in practice because a
// fixing has nowhere for the tool to go, or because the installation sequence blocks
// its own access. This is a second, independent analysis layer over the same junction.

export interface Fixing {
  id: string
  name: string
  /** e.g. "M12 bolt", "shot-fired pin", "weld", "proprietary bracket" */
  type: string
  /** e.g. "torque wrench", "impact driver", "welding equipment" */
  toolType: string
  /** mm of working space the tool needs around the fixing point to operate — not just the fixing itself. */
  requiredClearance: number
  /** mm of space actually available around the fixing point at nominal junction geometry. */
  nominalAvailableClearance: number
  /**
   * How many mm this fixing's available clearance shifts for every 1mm the junction's
   * dimensional outcome shifts from its nominal value. Captures that a fixing's access
   * envelope is consumed by the same tolerance chain as the dimensional gap — not an
   * independent variable. Positive: clearance opens up as the outcome grows. Negative:
   * clearance closes as the outcome grows. Zero: this fixing's access is unaffected by
   * the junction's dimensional variation.
   */
  clearanceSensitivity: number
  oneSideAccessOnly: boolean
  lineOfSightRequired: boolean
  /** Ids of other fixings at this junction that must already be installed before this one is accessible. */
  mustFollow: string[]
  /** Ids of other fixings at this junction that must NOT yet be installed when this one is done. */
  mustPrecede: string[]
}

export type AccessFlag = 'pass' | 'marginal' | 'fail'

export interface FixingStaticAccessResult {
  requiredClearance: number
  nominalClearance: number
  worstCaseClearance: number
  nominalFlag: AccessFlag
  worstCaseFlag: AccessFlag
  overallFlag: AccessFlag
  /** requiredClearance - worstCaseClearance, mm. Positive means the envelope doesn't fit; 0 if it does. */
  shortfall: number
}

export interface FixingToleranceSensitivityResult {
  runs: number
  clearanceFailCount: number
  clearanceFailRate: number
  worstClearance: number
  flag: AccessFlag
}

export interface FixingResult {
  fixingId: string
  fixingName: string
  staticAccess: FixingStaticAccessResult
  toleranceSensitivity: FixingToleranceSensitivityResult | null
  sequenceOk: boolean
  overallFlag: AccessFlag
}

export interface SequenceIssue {
  fixingIds: string[]
  reason: string
}

export interface SequenceCheckResult {
  satisfiable: boolean
  /** A valid installation order of fixing ids — only every fixing that isn't part of an issue below. */
  order: string[]
  issues: SequenceIssue[]
}

export interface BuildabilityResult {
  fixings: FixingResult[]
  sequence: SequenceCheckResult
  overallFlag: AccessFlag
}
