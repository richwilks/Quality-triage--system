export type Reg38Regime = 'reg38' | 'golden_thread'

export type Reg38ItemDef = {
  key: string
  label: string
  regime: Reg38Regime
  guidance: string
}

// Regulation 38 (Building Regulations 2010) - the package of fire safety
// information the person carrying out the work must hand to the building's
// Responsible Person no later than completion/occupation, so they can
// operate, maintain, and risk-assess the building. There's no statutory
// checklist - required documents vary by building type/complexity/systems -
// so this is the commonly-expected core set, not an exhaustive legal list.
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

// Golden Thread (Building Safety Act 2022, s.88/s.94) - formally mandatory
// for Higher-Risk Buildings (residential, 18m+ or 7+ storeys in England),
// but kept visible on every project as good record-keeping practice. The UI
// should label these "Legally required" vs "Recommended" based on the
// project's higher_risk_building flag, not hide them outright.
export const GOLDEN_THREAD_ITEMS: Reg38ItemDef[] = [
  {
    key: 'design_construction_records',
    label: 'Design & construction records',
    regime: 'golden_thread',
    guidance:
      'Architectural and structural plans, including material specifications for fire-resistant materials, cladding, and insulation used.',
  },
  {
    key: 'fire_safety_systems_data',
    label: 'Fire safety systems data',
    regime: 'golden_thread',
    guidance:
      'All data on the fire safety systems installed - what they are, how they work, and how they were verified to work.',
  },
  {
    key: 'change_compliance_records',
    label: 'Change & compliance records',
    regime: 'golden_thread',
    guidance:
      'A record of any changes made during design or construction - what changed, why, and how it was approved - plus how the finished building complies with the regulations it was approved against.',
  },
  {
    key: 'completion_certificates',
    label: 'Completion certificates',
    regime: 'golden_thread',
    guidance:
      'Building control completion certificate(s) confirming the finished work was signed off.',
  },
  {
    key: 'gateway_approvals',
    label: 'Gateway 2 / 3 approval records',
    regime: 'golden_thread',
    guidance:
      'For Higher-Risk Buildings: the Building Safety Regulator\'s Gateway 2 (pre-construction) and Gateway 3 (pre-occupation) approval records.',
  },
  {
    key: 'information_custodian',
    label: 'Information custodian record',
    regime: 'golden_thread',
    guidance:
      'A record of who currently holds and is responsible for keeping the golden thread of information up to date once the building is occupied.',
  },
]

export const REG38_ALL_ITEMS: Reg38ItemDef[] = [...REG38_ITEMS, ...GOLDEN_THREAD_ITEMS]

export function reg38ItemByKey(key: string): Reg38ItemDef | undefined {
  return REG38_ALL_ITEMS.find((i) => i.key === key)
}
