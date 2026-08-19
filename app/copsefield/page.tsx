'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TICKET_STATUS_COLOR } from '@/lib/copsefieldTaxonomy'

type Building = { id: string; name: string; building_code: string }
type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  status: string
  building_id: string
}

export default function CopsefieldHomePage() {
  const supabase = createClient()
  const [isStaff, setIsStaff] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
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
    }

    const { data: ticketData } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, status, building_id')
      .not('status', 'in', '(actioned,deferred)')
      .order('created_at', { ascending: false })
      .limit(10)
    setTickets(ticketData || [])

    setLoading(false)
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
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-8 w-8 rounded-md object-contain" />
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Buildings</p>
                <p className="mt-1 text-2xl font-semibold text-deck-text">{buildings.length}</p>
              </div>
              <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Open tickets</p>
                <p className="mt-1 text-2xl font-semibold text-deck-text">{tickets.length}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href="/copsefield/inspections/new"
                className="flex-1 rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
              >
                + New inspection
              </Link>
              <Link
                href="/copsefield/buildings/new"
                className="flex-1 rounded-md border border-deck-border px-4 py-2 text-center text-sm font-medium text-deck-text"
              >
                + New building
              </Link>
            </div>

            <div className="mt-5">
              <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-deck-dim">Quick Access</h2>
              <div className="overflow-hidden rounded-md border border-deck-border">
                <Link
                  href="/copsefield/buildings"
                  className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
                >
                  <span>Buildings</span>
                  <span className="text-deck-mute">→</span>
                </Link>
                <Link
                  href="/copsefield/dashboard"
                  className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
                >
                  <span>Dashboard</span>
                  <span className="text-deck-mute">→</span>
                </Link>
                <Link
                  href="/copsefield/work-orders"
                  className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
                >
                  <span>Work Orders</span>
                  <span className="text-deck-mute">→</span>
                </Link>
                <Link
                  href="/copsefield/economic-reports"
                  className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
                >
                  <span>Economic Reports</span>
                  <span className="text-deck-mute">→</span>
                </Link>
                <Link
                  href="/copsefield/reports/asset-condition-example"
                  className="flex items-center justify-between bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
                >
                  <span>Asset Condition Report (example)</span>
                  <span className="text-deck-mute">→</span>
                </Link>
              </div>
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Buildings</h2>
            {buildings.length === 0 && (
              <p className="mt-2 text-sm text-deck-dim">
                No buildings yet.{' '}
                <Link href="/copsefield/buildings/new" className="font-medium text-copsefield-accent underline">
                  Add your first one
                </Link>
                .
              </p>
            )}
            <div className="mt-2 space-y-2">
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

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          {isStaff ? 'Recent open tickets' : 'Your tickets'}
        </h2>
        {tickets.length === 0 && (
          <p className="mt-2 text-sm text-deck-dim">
            No tickets yet.{' '}
            <Link href="/copsefield/tickets/new" className="font-medium text-copsefield-accent underline">
              Raise one
            </Link>
            .
          </p>
        )}
        <div className="mt-2 space-y-1.5">
          {tickets.map((t) => (
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

        {!isStaff && (
          <Link
            href="/copsefield/tickets/new"
            className="mt-5 block w-full rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
          >
            Raise a ticket
          </Link>
        )}
      </div>
    </div>
  )
}
