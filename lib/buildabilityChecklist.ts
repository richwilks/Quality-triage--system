export type BuildabilityCategory =
  | 'access_lifting'
  | 'sequencing_coordination'
  | 'interfaces_tolerances'
  | 'fixings_connections'
  | 'site_conditions'

export type BuildabilityItemDef = {
  key: string
  label: string
  category: BuildabilityCategory
  guidance: string
}

export const BUILDABILITY_CATEGORY_LABELS: Record<BuildabilityCategory, string> = {
  access_lifting: 'Access & lifting',
  sequencing_coordination: 'Sequencing & coordination',
  interfaces_tolerances: 'Interfaces & tolerances',
  fixings_connections: 'Fixings & connections',
  site_conditions: 'Site conditions',
}

// A practical checklist of common buildability risk patterns - the kind of thing an
// experienced design/site manager checks for by eye when reading a drawing, before
// it becomes a site problem. This is a working reference list built from general
// industry buildability-review practice, not a citation of any single standard or
// company procedure - treat it as a starting checklist to extend with real project
// experience, not an exhaustive or authoritative list.
export const BUILDABILITY_CHECKLIST: BuildabilityItemDef[] = [
  {
    key: 'crane_reach_lift_weight',
    label: 'Crane reach and lift weight',
    category: 'access_lifting',
    guidance:
      'Can the specified crane(s) actually reach this component\'s final position at this lift weight, from a plausible standing position on this site? Oversized precast panels, plant, and long steel members are the usual culprits.',
  },
  {
    key: 'delivery_vehicle_access',
    label: 'Delivery vehicle access',
    category: 'access_lifting',
    guidance:
      'Can an oversized or heavy component (long steel member, large precast panel, plant item) physically get to site and to its unloading point given the access route, turning circles, and any height/weight restrictions?',
  },
  {
    key: 'confined_access_after_enclosure',
    label: 'Confined access after enclosure',
    category: 'access_lifting',
    guidance:
      'Once the structure or envelope is closed in, will finishing trades still be able to get materials and tools into the space, or was access only ever available before enclosure?',
  },
  {
    key: 'trade_sequencing_conflict',
    label: 'Trade sequencing conflict',
    category: 'sequencing_coordination',
    guidance:
      'Does the drawing imply a sequence where one trade\'s work would need to happen before another\'s is complete in the same location - e.g. structural encasement before MEP first-fix, or finishes before a service that routes through them?',
  },
  {
    key: 'temporary_works_implied',
    label: 'Implied temporary works',
    category: 'sequencing_coordination',
    guidance:
      'Does an element rely on propping, temporary restraint, or staged loading to be stable during construction, even though no temporary works are shown on this drawing?',
  },
  {
    key: 'element_inaccessible_after_later_stage',
    label: 'Element inaccessible after a later stage',
    category: 'sequencing_coordination',
    guidance:
      'Would a fixing, connection, or inspection point shown here become physically blocked or unreachable once a later-sequenced element goes in around or in front of it?',
  },
  {
    key: 'system_interface_tolerance',
    label: 'Interface between different systems',
    category: 'interfaces_tolerances',
    guidance:
      'At a junction between two different structural or envelope systems (e.g. precast to steel frame, curtain wall to concrete), could realistic manufacturing/erection tolerance on both sides cause a fit, gap, or clash problem the nominal drawing doesn\'t show?',
  },
  {
    key: 'movement_joint_continuity',
    label: 'Movement joint continuity',
    category: 'interfaces_tolerances',
    guidance:
      'Where a movement or expansion joint crosses from one system to another, does the joint actually continue through the junction, or does the drawing leave a gap in provision at the interface?',
  },
  {
    key: 'envelope_continuity',
    label: 'Waterproofing / air-tightness continuity',
    category: 'interfaces_tolerances',
    guidance:
      'At a change of material or system in the building envelope, is there a continuous, buildable detail for the waterproofing or air-tightness line, or does it rely on a junction that\'s difficult to seal in practice?',
  },
  {
    key: 'tool_access_for_connection',
    label: 'Tool access for the connection',
    category: 'fixings_connections',
    guidance:
      'Does this connection detail (bolted, welded, or otherwise) assume a tool (torque wrench, welding equipment, powder-actuated tool) can actually reach and operate at this fixing point, given what\'s around it?',
  },
  {
    key: 'fixing_sequence_undefined',
    label: 'Fixing installation order undefined',
    category: 'fixings_connections',
    guidance:
      'Where several fixings or connections are shown at one junction, is there a workable order to install them, or could installing one block access to another?',
  },
  {
    key: 'work_at_height_or_over_live_area',
    label: 'Work at height or over a live area',
    category: 'site_conditions',
    guidance:
      'Does this element need to be built at height, or above/adjacent to an area that may be occupied or in use during construction, without an evident access or edge-protection strategy on the drawing?',
  },
  {
    key: 'existing_structure_uncertainty',
    label: 'Existing structure / below-ground interface',
    category: 'site_conditions',
    guidance:
      'Does this element connect to existing structure, retained fabric, or below-ground conditions where the as-built reality may differ from what\'s drawn, with no evident allowance for that uncertainty?',
  },
]

export function buildabilityChecklistByCategory(): Map<BuildabilityCategory, BuildabilityItemDef[]> {
  const byCategory = new Map<BuildabilityCategory, BuildabilityItemDef[]>()
  for (const item of BUILDABILITY_CHECKLIST) {
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }
  return byCategory
}

export function buildabilityItemByKey(key: string): BuildabilityItemDef | undefined {
  return BUILDABILITY_CHECKLIST.find((i) => i.key === key)
}
