// Copsefield's asset category (L1) / component (L2) taxonomy, and the
// fixed vocab for issue type, priority, and ticket status - taken from
// Copsefield's own recommendation register spreadsheet so tickets stay
// consistent with how the business already categorizes findings.

export const BUILDING_TYPES = [
  { value: 'strata', label: 'Strata', prefix: 'ST' },
  { value: 'multifamily', label: 'Multifamily rental', prefix: 'MF' },
  { value: 'commercial', label: 'Commercial', prefix: 'CM' },
  { value: 'institutional', label: 'Institutional', prefix: 'IN' },
] as const

export type BuildingType = (typeof BUILDING_TYPES)[number]['value']

export function buildingPrefix(type: string): string {
  return BUILDING_TYPES.find((t) => t.value === type)?.prefix || 'XX'
}

export function buildingCode(type: string, number: number): string {
  return `${buildingPrefix(type)}${String(number).padStart(4, '0')}`
}

export const ASSET_TAXONOMY: Record<string, string[]> = {
  Roofing: [
    'Covering/Membrane',
    'Flashings',
    'Drainage & guttering',
    'Fascia',
    'Soffits',
    'Penetrations',
    'Parapets',
    'Access',
    'Equipment & supports',
    'Sealants & joints',
    'Other',
  ],
  Structure: [
    'Foundations',
    'Columns',
    'Beams',
    'Slabs',
    'Walls',
    'Stairs & landings',
    'Movement/Expansion joints',
    'Other',
  ],
  Envelope: [
    'External Walls/Facades',
    'Cladding',
    'Windows',
    'External Doors',
    'Balconies & Terraces',
    'Guardrails & balustrades',
    'Sealants & Joints',
    'Flashings',
    'Soffits',
    'Canopies',
    'Waterproofing',
    'Other',
  ],
  'Interior Common areas': [
    'Walls & Partitions',
    'Ceilings',
    'Flooring',
    'Internal Doors',
    'Stairs & Landings',
    'Corridors',
    'Lobbies & Entrances',
    'Fixtures & Fittings',
    'Storage Areas',
    'Other',
  ],
  'Parking and Parkade': [
    'Parking Surfaces',
    'Traffic Membranes',
    'Walls',
    'Columns',
    'Slabs',
    'Drainage',
    'Expansion Joints',
    'Vehicle Gates & Doors',
    'Barriers & Protection',
    'Line Marking & Signage',
    'Bike storage/racks',
    'Other',
  ],
  'Mechanical Systems': [
    'Heating',
    'Cooling',
    'Domestic Hot Water',
    'Plumbing',
    'Drainage',
    'Ventilation',
    'Pumps',
    'Controls',
    'Gas Systems',
    'Mechanical Plant',
    'Other',
  ],
  'Electrical Systems': [
    'Electrical Distribution',
    'Panels & Switchgear',
    'Lighting',
    'Emergency Lighting',
    'Standby / Emergency Power',
    'Access Control',
    'Intercom',
    'CCTV / Security',
    'EV Charging',
    'Other',
  ],
  'Life Safety Systems': [
    'Fire Alarm',
    'Sprinklers',
    'Standpipes / Hose Systems',
    'Fire Extinguishers',
    'Smoke Control',
    'Fire Separation',
    'Fire Doors',
    'Emergency Signage',
    'Other',
  ],
  'Vertical Transportation': ['Elevators', 'Escalators', 'Accessibility Lifts', 'Controls', 'Other'],
  'Internal Amenities': [
    'Gym / Fitness',
    'Pool / Spa',
    'Sauna / Steam Room',
    'Resident Lounge',
    'Games / Entertainment Rooms',
    'Guest Suites',
    'Kitchens / Entertaining Areas',
    'Washrooms / Change Rooms',
    'Other',
  ],
  'External Amenities': [
    'Pool / Spa',
    'Patios / Terraces',
    'BBQ / Outdoor Kitchen',
    'Play Areas',
    'Sports / Recreation Areas',
    'Furniture & Fixtures',
    'Other',
  ],
  'Waste and service areas': [
    'Garbage Rooms',
    'Recycling Areas',
    'Waste Chutes',
    'Compactors',
    'Loading / Delivery Areas',
    'Service Rooms',
    'Other',
  ],
  'External Area and Landscaping': [
    'Roads & Driveways',
    'Sidewalks & Pathways',
    'Hard Landscaping / Paving',
    'Soft Landscaping / Planting',
    'Irrigation',
    'Fencing & Gates',
    'Site Walls',
    'Site Drainage',
    'Exterior Lighting',
    'Signage',
    'Other',
  ],
}

export const ASSET_CATEGORIES = Object.keys(ASSET_TAXONOMY)

export const ISSUE_TYPES = [
  { value: 'condition', label: 'Condition' },
  { value: 'water_moisture', label: 'Water and Moisture' },
  { value: 'performance', label: 'Performance' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'end_of_life', label: 'End of Life' },
  { value: 'other', label: 'Other' },
] as const

export const PRIORITY_SCALE: { value: number; label: string }[] = [
  { value: 10, label: 'Immediate attention / make safe / specialist response' },
  { value: 9, label: 'Action as soon as practicable' },
  { value: 8, label: 'Action recommended within 3 months' },
  { value: 7, label: 'Action recommended within 6 months' },
  { value: 6, label: 'Action recommended within 12 months' },
  { value: 5, label: 'Action recommended within 24 months' },
  { value: 4, label: 'Planned action anticipated, timing not currently critical' },
  { value: 3, label: 'Continue monitoring - intervention may become necessary' },
  { value: 2, label: 'Routine monitoring - no current intervention recommended' },
  { value: 1, label: 'Noted for record / observe during future reviews' },
]

export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', description: 'Just logged, not yet looked at' },
  { value: 'under_review', label: 'Under review', description: 'An inspector is assessing it on site' },
  { value: 'recommended', label: 'Recommended', description: "Copsefield's recommendation is recorded" },
  { value: 'planned', label: 'Planned', description: 'The building intends to progress it' },
  { value: 'in_progress', label: 'In progress', description: 'Work has started' },
  { value: 'actioned', label: 'Actioned', description: 'Complete' },
  { value: 'deferred', label: 'Deferred', description: 'The building has decided not to progress it for now' },
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]['value']

export const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  recommended: 'bg-deck-raised text-deck-dim',
  planned: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-orange-100 text-orange-700',
  actioned: 'bg-emerald-100 text-emerald-700',
  deferred: 'bg-deck-raised text-deck-mute',
}

export function priorityColor(priority: number | null): string {
  if (priority === null) return 'bg-deck-raised text-deck-dim'
  if (priority >= 9) return 'bg-red-100 text-red-700'
  if (priority >= 7) return 'bg-orange-100 text-orange-700'
  if (priority >= 5) return 'bg-amber-100 text-amber-700'
  return 'bg-deck-raised text-deck-dim'
}
