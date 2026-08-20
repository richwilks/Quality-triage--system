'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CopsefieldBar from '@/components/CopsefieldBar'
import { TICKET_STATUSES, TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'
import { computeTicketStats, StatsTicket } from '@/lib/copsefieldStats'

type Building = { id: string; name: string; building_code: string }

type Ticket = StatsTicket & {
  unique_ref: string
  created_at: string
}

export default function CopsefieldHomePage() {
  const supabase = createClient()
  const router = useRouter()
  const [isStaff, setIsStaff] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('copsefield_role').eq('id', user.id).single()
    const staff = profile?.copsefield_role !== 'owner'
    setIsStaff(staff)

    if (staff) {
      const { data: buildingData } = await supabase
        .from('copsefield_buildings')
        .select('id, name, building_code')
        .order('created_at', { ascending: false })
      setBuildings(buildingData || [])

      const { data: ticketData } = await supabase
        .from('copsefield_tickets')
        .select(
          'id, unique_ref, asset_category, status, priority, planning_allowance_low, planning_allowance_high, building_id, created_at, copsefield_buildings(name, building_code)'
        )
      setTickets((ticketData || []) as unknown as Ticket[])
    } else {
      const { data: myTicketData } = await supabase
        .from('copsefield_tickets')
        .select('id, unique_ref, asset_category, status, priority, planning_allowance_low, planning_allowance_high, building_id, created_at')
        .not('status', 'in', '(actioned,deferred)')
        .order('created_at', { ascending: false })
        .limit(10)
      setMyTickets((myTicketData || []) as unknown as Ticket[])
    }

    setLoading(false)
  }

  const stats = useMemo(() => computeTicketStats(tickets), [tickets])

  const topTickets = useMemo(() => {
    return [...tickets]
      .filter((t) => t.status !== 'actioned' && t.status !== 'deferred')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10)
  }, [tickets])

  function getBuilding(t: Ticket) {
    if (!t.copsefield_buildings) return null
    return Array.isArray(t.copsefield_buildings) ? t.copsefield_buildings[0] : t.copsefield_buildings
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className={`mx-auto ${isStaff ? 'max-w-6xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-copsefield-dark p-1.5">
              <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-full w-full object-contain" />
            </span>
            <h1 className="text-xl font-semibold text-deck-text">Copsefield Group</h1>
          </div>
          {isStaff && (
            <Link href="/choose" className="text-xs font-medium text-deck-dim underline">
              Switch system
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm text-deck-dim">
          {isStaff ? 'Property inspections & ticket management.' : 'Raise and track issues for your building.'}
        </p>

        {isStaff && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Open tickets</p>
                <p className="mt-1 text-2xl font-semibold text-deck-text">{stats.openCount}</p>
              </div>
              <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Priority 8+</p>
                <p className="mt-1 text-2xl font-semibold text-red-600">{stats.urgentCount}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-deck-border bg-deck-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Planning allowance outstanding</p>
                <p className="mt-1 text-lg font-semibold text-deck-text">
                  {stats.totalLow.toLocaleString()} - {stats.totalHigh.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href="/copsefield/inspections/new"
                className="flex-1 rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg lg:flex-none lg:px-8"
              >
                + New inspection
              </Link>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-deck-dim">Tickets by status</h2>
                <div className="space-y-2 rounded-lg border border-deck-border bg-deck-surface p-4">
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
              </div>

              <div>
                <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-deck-dim">Top categories</h2>
                <div className="space-y-2 rounded-lg border border-deck-border bg-deck-surface p-4">
                  {stats.categoryEntries.map(([category, count]) => (
                    <CopsefieldBar key={category} label={category} count={count} max={stats.maxCategory} colorClass="bg-copsefield-accent" />
                  ))}
                  {stats.categoryEntries.length === 0 && <p className="text-sm text-deck-dim">No tickets yet.</p>}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Top 10 tickets</h2>
              <Link href="/copsefield/tickets" className="text-xs font-medium text-copsefield-accent underline">
                View all
              </Link>
            </div>
            {topTickets.length === 0 && <p className="mt-2 text-sm text-deck-dim">No open tickets right now.</p>}
            {topTickets.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                      <th className="px-3 py-2 font-medium">Reference</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Building</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTickets.map((t) => {
                      const building = getBuilding(t)
                      return (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/copsefield/tickets/${t.id}`)}
                          className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-deck-dim">{t.unique_ref}</td>
                          <td className="px-3 py-2 text-deck-text">{t.asset_category}</td>
                          <td className="px-3 py-2 text-xs text-deck-dim">{building ? `${building.name} (${building.building_code})` : '-'}</td>
                          <td className="px-3 py-2">
                            {t.priority !== null ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                            ) : (
                              <span className="text-xs text-deck-mute">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">Buildings</h2>
            {buildings.length === 0 && (
              <p className="mt-2 text-sm text-deck-dim">
                No buildings yet.{' '}
                <Link href="/copsefield/buildings/new" className="font-medium text-copsefield-accent underline">
                  Add your first one
                </Link>
                .
              </p>
            )}
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {buildings.slice(0, 6).map((b) => (
                <Link key={b.id} href={`/copsefield/buildings/${b.id}`} className="block rounded-lg border border-deck-border bg-deck-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-deck-text">{b.name}</p>
                    <span className="font-mono text-xs text-deck-mute">{b.building_code}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!isStaff && (
          <>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Your tickets</h2>
            {myTickets.length === 0 && (
              <p className="mt-2 text-sm text-deck-dim">
                No tickets yet.{' '}
                <Link href="/copsefield/tickets/new" className="font-medium text-copsefield-accent underline">
                  Raise one
                </Link>
                .
              </p>
            )}
            <div className="mt-2 space-y-1.5">
              {myTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/copsefield/tickets/${t.id}`}
                  className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-mono text-deck-dim">{t.unique_ref}</p>
                    <p className="text-sm text-deck-text">{t.asset_category}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>

            <Link
              href="/copsefield/tickets/new"
              className="mt-5 block w-full rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
            >
              Raise a ticket
            </Link>
            <Link
              href="/copsefield/reports"
              className="mt-3 block w-full rounded-md border border-copsefield-accent px-4 py-2 text-center text-sm font-medium text-copsefield-accent"
            >
              View your reports
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
