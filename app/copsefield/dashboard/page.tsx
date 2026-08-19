'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { TICKET_STATUSES, TICKET_STATUS_COLOR } from '@/lib/copsefieldTaxonomy'

type Ticket = {
  id: string
  asset_category: string
  status: string
  priority: number | null
  planning_allowance_low: number | null
  planning_allowance_high: number | null
  building_id: string
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

function Bar({ label, count, max, colorClass }: { label: string; count: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 truncate text-xs text-deck-dim">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-deck-raised">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-medium text-deck-body">{count}</span>
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_tickets')
      .select('id, asset_category, status, priority, planning_allowance_low, planning_allowance_high, building_id, copsefield_buildings(name, building_code)')
    setTickets((data || []) as unknown as Ticket[])
    setLoading(false)
  }

  const stats = useMemo(() => {
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
  }, [tickets])

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Dashboard" />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-2xl font-semibold text-deck-text">{stats.openCount}</p>
            <p className="text-xs text-deck-dim">Open tickets</p>
          </div>
          <div className="rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-2xl font-semibold text-red-600">{stats.urgentCount}</p>
            <p className="text-xs text-deck-dim">Priority 8+ outstanding</p>
          </div>
          <div className="col-span-2 rounded-lg border border-deck-border bg-deck-surface p-3">
            <p className="text-lg font-semibold text-deck-text">
              {stats.totalLow.toLocaleString()} - {stats.totalHigh.toLocaleString()}
            </p>
            <p className="text-xs text-deck-dim">Planning allowance outstanding across all open tickets</p>
          </div>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">By status</h2>
        <div className="mt-3 space-y-2">
          {TICKET_STATUSES.map((s) => (
            <Bar
              key={s.value}
              label={s.label}
              count={stats.byStatus[s.value] || 0}
              max={stats.maxStatus}
              colorClass={TICKET_STATUS_COLOR[s.value].split(' ')[0]}
            />
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Top categories</h2>
        <div className="mt-3 space-y-2">
          {stats.categoryEntries.map(([category, count]) => (
            <Bar key={category} label={category} count={count} max={stats.maxCategory} colorClass="bg-copsefield-accent" />
          ))}
          {stats.categoryEntries.length === 0 && <p className="text-sm text-deck-dim">No tickets yet.</p>}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Buildings with the most open tickets</h2>
        <div className="mt-3 space-y-1.5">
          {stats.buildingEntries.map((b) => (
            <div key={b.code} className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2">
              <span className="text-sm text-deck-text">{b.name}</span>
              <span className="font-mono text-xs text-deck-dim">
                {b.code} · {b.count}
              </span>
            </div>
          ))}
          {stats.buildingEntries.length === 0 && <p className="text-sm text-deck-dim">No tickets yet.</p>}
        </div>

        <Link href="/copsefield/tickets" className="mt-6 block w-full rounded-md border border-copsefield-accent px-3 py-2 text-center text-sm font-medium text-copsefield-accent">
          View all tickets
        </Link>
      </div>
    </div>
  )
}
