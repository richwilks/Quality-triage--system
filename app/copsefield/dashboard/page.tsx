'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CopsefieldBar from '@/components/CopsefieldBar'
import { TICKET_STATUSES, TICKET_STATUS_COLOR } from '@/lib/copsefieldTaxonomy'
import { computeTicketStats, StatsTicket } from '@/lib/copsefieldStats'

export default function DashboardPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<StatsTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('copsefield_tickets')
      .select('id, asset_category, status, priority, planning_allowance_low, planning_allowance_high, building_id, copsefield_buildings(name, building_code)')
    setTickets((data || []) as unknown as StatsTicket[])
    setLoading(false)
  }

  const stats = useMemo(() => computeTicketStats(tickets), [tickets])

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
            <CopsefieldBar
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
            <CopsefieldBar key={category} label={category} count={count} max={stats.maxCategory} colorClass="bg-copsefield-accent" />
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
