export type Reg38Regime = 'reg38' | 'golden_thread'

export type Reg38ItemDef = {
  key: string
  label: string
  regime: Reg38Regime
  guidance: string
}

// Regulation 38 (Building Regulations 2010, SI 2010/2214) - the package of
// fire safety information the person carrying out the work must hand to the
// building's Responsible Person no later than completion/occupation, so
// they can operate, maintain, and risk-assess the building. Regulation 38
// itself does not prescribe a document checklist - required documents vary
// by building type/complexity/systems installed - so this is the
// commonly-expected core set per industry guidance (fire engineers,
// approved inspectors), not an exhaustive statutory list. Cross-checked
// against multiple independent sources describing what's typically
// expected in a Reg 38 handover pack.
export const REG38_ITEMS: Reg38ItemDef[] = [
  {
    key: 'fire_strategy',
    label: 'Fire strategy (as-built)',
    regime: 'reg38',
    guidance:
      'Upload the final as-built fire strategy, not the design-stage version - this is usually the core document a reviewer checks first, and it needs to reflect what was actually built.',
  },
  {
    key: 'as_built_drawings',
    label: 'As-built drawings',
    regime: 'reg38',
    guidance:
      'Dimensioned drawings showing final escape routes, maximum occupant capacity per area, and the precise location of fire safety equipment (call points, sounders, extinguishers).',
  },
  {
    key: 'om_manuals',
    label: 'Operating & maintenance manuals',
    regime: 'reg38',
    guidance:
      'Full O&M manuals for every active fire system installed (detection/alarm, voice alarm, sprinklers, smoke control), including any cause-and-effect matrix and the mandatory routine maintenance schedule.',
  },
  {
    key: 'passive_fire_protection',
    label: 'Passive fire protection records',
    regime: 'reg38',
    guidance:
      'Exact locations, fire resistance (FR) and integrity/insulation (EI) ratings for every fire-separating element - compartment walls/floors, fire doors, penetration seals.',
  },
  {
    key: 'commissioning_certificates',
    label: 'Commissioning certificates',
    regime: 'reg38',
    guidance:
      'Signed commissioning certificates for each active fire safety system, confirming it was tested and works as designed before handover.',
  },
  {
    key: 'fire_risk_assessment_pack',
    label: 'Fire risk assessment information pack',
    regime: 'reg38',
    guidance:
      'Enough information for the Responsible Person to carry out an effective fire risk assessment post-occupation - building layout, construction materials, and fire safety provisions.',
  },
  {
    key: 'responsible_person_acknowledgement',
    label: "Responsible Person's acknowledgement",
    regime: 'reg38',
    guidance:
      'The signed notice from the Responsible Person acknowledging receipt of the fire safety information and confirming it is sufficient to understand, operate and maintain the building. This is the final step - upload it once they\'ve signed.',
  },
]

// Golden Thread information: Building Safety Act 2022 s.88 is the duty on
// the Accountable Person for an occupied, registered Higher-Risk Building to
// keep this information - a distinct, later duty from the Gateway 2/3
// design-and-construction control process, though records from that phase
// feed into it. The actual required categories are set out in Schedule 1 to
// The Higher-Risk Buildings (Keeping and Provision of Information etc.)
// (England) Regulations 2024 (SI 2024/41) - prescribed information under
// BSA s.88(1) (Schedule 1 paras 2-14) and prescribed documents under BSA
// s.88(2) (paras 16-31). This list is built from converging government/HSE
// guidance and independent legal summaries of that Schedule, NOT from
// reading legislation.gov.uk directly (blocked from this build
// environment) - treat it as a strong starting checklist, not a verified
// substitute for a qualified person checking SI 2024/41 itself before
// relying on it for compliance. Kept visible on every project as good
// record-keeping practice even where not legally mandated; the UI labels
// these "Legally required" vs "Recommended" based on the project's
// higher_risk_building flag rather than hiding them outright.
export const GOLDEN_THREAD_ITEMS: Reg38ItemDef[] = [
  {
    key: 'key_building_information',
    label: 'Key building information',
    regime: 'golden_thread',
    guidance:
      'The core descriptive facts about the building - address, height, number of storeys, number of residential units, and principal accountable person details.',
  },
  {
    key: 'registration_certificate',
    label: 'Building registration & certificate',
    regime: 'golden_thread',
    guidance:
      "The building's registration with the Building Safety Regulator and the registration certificate issued for it - required before the building can be lawfully occupied.",
  },
  {
    key: 'building_assessment_certificate',
    label: 'Building assessment certificate records',
    regime: 'golden_thread',
    guidance:
      "The application for, and (once issued) the Building Assessment Certificate itself - valid for 5 years, confirming the Accountable Person's safety case has been assessed by the regulator.",
  },
  {
    key: 'design_construction_records',
    label: 'Design & construction records',
    regime: 'golden_thread',
    guidance:
      "Original design plans and as-built drawings, including material specifications for the external wall system, cladding, insulation, and structural design. A project's As-built record (dimensions recorded on drawings during site inspections) is a ready-made source for this - see the project's \"As-built record\" page.",
  },
  {
    key: 'construction_control_plan',
    label: 'Construction control plan',
    regime: 'golden_thread',
    guidance:
      'The plan describing the strategies, policies and procedures used to keep construction work compliant with building regulations, including how evidence was captured throughout the build.',
  },
  {
    key: 'structural_fire_risk_assessments',
    label: 'Structural & fire safety risk assessments',
    regime: 'golden_thread',
    guidance:
      'Assessments of the risk of structural failure and of fire spread within and from the building - the analysis behind the fire and structural safety strategy, not just the strategy document itself.',
  },
  {
    key: 'fire_and_emergency_file',
    label: 'Fire and emergency file',
    regime: 'golden_thread',
    guidance:
      'The building-specific file used by fire and rescue services in an emergency - a named, distinct document from the general fire strategy, covering building layout, systems, and evacuation-relevant information.',
  },
  {
    key: 'safety_management_system',
    label: 'Building safety management system',
    regime: 'golden_thread',
    guidance:
      "The Accountable Person's overarching system for managing building safety risks day to day - policies, roles, and processes, not a one-off assessment.",
  },
  {
    key: 'mandatory_occurrence_reporting',
    label: 'Mandatory occurrence reporting record',
    regime: 'golden_thread',
    guidance:
      'The process and record for reporting structural or fire safety occurrences that meet the mandatory reporting threshold to the Building Safety Regulator.',
  },
  {
    key: 'resident_engagement_strategy',
    label: 'Resident engagement strategy',
    regime: 'golden_thread',
    guidance:
      'The strategy for engaging residents on building safety decisions, including how their views are sought and taken into account.',
  },
  {
    key: 'complaints_handling_procedure',
    label: "Residents' complaints handling procedure",
    regime: 'golden_thread',
    guidance:
      "The Accountable Person's procedure for residents to raise building safety complaints, and how those complaints are recorded and responded to.",
  },
  {
    key: 'change_compliance_records',
    label: 'Change & compliance records',
    regime: 'golden_thread',
    guidance:
      "A record of changes made during design, construction, or occupation - what changed, why, and how it was approved - plus how the building complies with the regulations it was approved against. The project's As-built record shows dimensions actually measured on site against each drawing, useful evidence of what changed from the design-stage version.",
  },
  {
    key: 'completion_certificates',
    label: 'Completion certificates',
    regime: 'golden_thread',
    guidance: 'Building control completion certificate(s) confirming the finished work was signed off.',
  },
  {
    key: 'gateway_approvals',
    label: 'Gateway 2 / 3 approval records',
    regime: 'golden_thread',
    guidance:
      "The Building Safety Regulator's Gateway 2 (pre-construction) and Gateway 3 (pre-occupation) approval records - part of design-and-construction control, feeding into the golden thread once the building is occupied.",
  },
  {
    key: 'information_custodian',
    label: 'Information custodian record',
    regime: 'golden_thread',
    guidance:
      'A practical record (not itself a named statutory document) of who currently holds and is responsible for keeping the golden thread of information up to date once the building is occupied.',
  },
]

export const REG38_ALL_ITEMS: Reg38ItemDef[] = [...REG38_ITEMS, ...GOLDEN_THREAD_ITEMS]

export function reg38ItemByKey(key: string): Reg38ItemDef | undefined {
  return REG38_ALL_ITEMS.find((i) => i.key === key)
}
