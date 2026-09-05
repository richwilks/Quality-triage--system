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
