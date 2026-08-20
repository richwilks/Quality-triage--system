import { TICKET_STATUSES } from '@/lib/copsefieldTaxonomy'

export type StatsTicket = {
  id: string
  asset_category: string
  status: string
  priority: number | null
  planning_allowance_low: number | null
  planning_allowance_high: number | null
  building_id: string
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

export function computeTicketStats(tickets: StatsTicket[]) {
  const byStatus: Record<string, number> = {}
  TICKET_STATUSES.forEach((s) => (byStatus[s.value] = 0))
  const byCategory: Record<string, number> = {}
  const byBuilding: Record<string, { name: string; code: string; count: number }> = {}
  let totalLow = 0
  let totalHigh = 0
  let urgentCount = 0
  let openCount = 0

  tickets.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
    byCategory[t.asset_category] = (byCategory[t.asset_category] || 0) + 1
    if (t.status !== 'actioned' && t.status !== 'deferred') {
      openCount += 1
      totalLow += t.planning_allowance_low || 0
      totalHigh += t.planning_allowance_high || 0
      if ((t.priority || 0) >= 8) urgentCount += 1
    }
    const b = Array.isArray(t.copsefield_buildings) ? t.copsefield_buildings[0] : t.copsefield_buildings
    if (b) {
      const key = t.building_id
      if (!byBuilding[key]) byBuilding[key] = { name: b.name, code: b.building_code, count: 0 }
      if (t.status !== 'actioned' && t.status !== 'deferred') byBuilding[key].count += 1
    }
  })

  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const buildingEntries = Object.values(byBuilding).sort((a, b) => b.count - a.count).slice(0, 8)
  const maxCategory = Math.max(1, ...categoryEntries.map(([, c]) => c))
  const maxBuilding = Math.max(1, ...buildingEntries.map((b) => b.count))
  const maxStatus = Math.max(1, ...Object.values(byStatus))

  return { byStatus, categoryEntries, buildingEntries, maxCategory, maxBuilding, maxStatus, totalLow, totalHigh, urgentCount, openCount }
}
