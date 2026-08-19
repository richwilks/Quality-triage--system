'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'

type Inspection = {
  id: string
  building_id: string
  visit_date: string
  status: string
  notes: string | null
  copsefield_buildings: { name: string; building_code: string } | { name: string; building_code: string }[] | null
}

type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  component: string | null
  status: string
  priority: number | null
}

export default function InspectionDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const inspectionId = params.id as string

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [inspectionId])

  async function load() {
    const { data: inspectionData } = await supabase
      .from('copsefield_inspections')
      .select('id, building_id, visit_date, status, notes, copsefield_buildings(name, building_code)')
      .eq('id', inspectionId)
      .single()
    setInspection(inspectionData as unknown as Inspection)

    const { data: ticketData } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, component, status, priority')
      .eq('inspection_id', inspectionId)
      .order('recommendation_number', { ascending: true })
    setTickets(ticketData || [])

    setLoading(false)
  }

  function getBuilding(i: Inspection) {
    if (!i.copsefield_buildings) return null
    return Array.isArray(i.copsefield_buildings) ? i.copsefield_buildings[0] : i.copsefield_buildings
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!inspection) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Inspection not found.</p>
      </div>
    )
  }

  const building = getBuilding(inspection)

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={building?.name || 'Inspection'} />
        <p className="mt-1 text-sm text-deck-dim">
          Visited {inspection.visit_date} ·{' '}
          <span className={inspection.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}>
            {inspection.status === 'completed' ? 'Completed' : 'In progress'}
          </span>
        </p>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Items raised ({tickets.length})
        </h2>
        {tickets.length === 0 && <p className="mt-2 text-sm text-deck-dim">No items were raised during this visit.</p>}
        <div className="mt-2 space-y-1.5">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/copsefield/tickets/${t.id}`}
              className="flex items-center justify-between rounded-md border border-deck-border bg-deck-surface px-3 py-2"
            >
              <div>
                <p className="text-xs font-mono text-deck-dim">{t.unique_ref}</p>
                <p className="text-sm text-deck-text">
                  {t.asset_category}
                  {t.component ? ` · ${t.component}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {t.priority !== null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {inspection.status !== 'completed' && (
          <Link
            href={`/copsefield/inspections/new?buildingId=${inspection.building_id}`}
            className="mt-5 block w-full rounded-md bg-copsefield-accent px-3 py-2 text-center text-sm font-medium text-deck-bg"
          >
            Continue this inspection
          </Link>
        )}
      </div>
    </div>
  )
}
