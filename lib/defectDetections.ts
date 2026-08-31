// Discipline-agnostic detection object, per the InspectIQ Defect Detection
// Architecture Note (Structural Module v1). Mirrors the `defect_detections`
// table - see that migration for column-level detail.
//
// This is deliberately separate from the `defects` table: `defects` is
// InspectIQ's operational, human-reviewed record (draft -> confirmed ->
// assigned -> closed). This table is raw output from a detection module
// (MBDD2025 or a future discipline module), upstream of any human review or
// conformance reasoning. `promotedDefectId` is the (currently unused) hook
// for the eventual "this detection became a real tracked defect" step.
export type DefectDetection = {
  id: string
  projectId: string
  discipline: string
  sourceModule: string
  defectClass: string
  structureType: string | null
  confidence: number | null
  imageRef: string | null
  boundingBox: { x: number; y: number; width: number; height: number } | null
  siteLocationTag: string | null
  severityEstimate: string | null
  standardReference: string | null
  conformanceStatus: string
  promotedDefectId: string | null
  createdBy: string | null
  createdAt: string
}
