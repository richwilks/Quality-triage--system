'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Property = {
  id: string
  name: string
  location: string | null
}

type PropertyStats = {
  total: number
  overdue: number
  openDeficiencies: number
}

export default function PortfolioPage() {
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [stats, setStats] = useState<Record<string, PropertyStats>>({})
  const [loading, setLoading] = useState(true)
  const [noOrg, setNoOrg] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      setNoOrg(true)
      setLoading(false)
      return
    }

    const { data: accessRows } = await supabase
      .from('fmiq_property_access')
      .select('property_id')
      .eq('org_id', profile.org_id)

    const propertyIds = Array.from(new Set((accessRows || []).map((r) => r.property_id)))
    if (propertyIds.length === 0) {
      setLoading(false)
      return
    }

    const { data: propertyData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location')
      .in('id', propertyIds)
      .order('name', { ascending: true })
    setProperties(propertyData || [])

    const { data: scheduledData } = await supabase
      .from('fmiq_scheduled_inspections')
      .select('id, property_id, status, due_date')
      .in('property_id', propertyIds)

    const today = new Date(new Date().toDateString())
    const statsByProperty: Record<string, PropertyStats> = {}
    ;(propertyData || []).forEach((p) => {
      statsByProperty[p.id] = { total: 0, overdue: 0, openDeficiencies: 0 }
    })
    ;(scheduledData || []).forEach((s) => {
      if (!statsByProperty[s.property_id]) statsByProperty[s.property_id] = { total: 0, overdue: 0, openDeficiencies: 0 }
      statsByProperty[s.property_id].total += 1
      const overdue = s.status !== 'completed' && new Date(s.due_date) < today
      if (overdue) statsByProperty[s.property_id].overdue += 1
    })

    const scheduledIds = (scheduledData || []).map((s) => s.id)
    if (scheduledIds.length > 0) {
      const { data: deficiencyData } = await supabase
        .from('fmiq_deficiencies')
        .select('status, fmiq_compliance_records!inner(scheduled_inspection_id)')
        .eq('status', 'open')

      const scheduledToProperty: Record<string, string> = {}
      ;(scheduledData || []).forEach((s) => {
        scheduledToProperty[s.id] = s.property_id
      })

      ;(deficiencyData || []).forEach((d: any) => {
        const record = Array.isArray(d.fmiq_compliance_records) ? d.fmiq_compliance_records[0] : d.fmiq_compliance_records
        const propId = record ? scheduledToProperty[record.scheduled_inspection_id] : null
        if (propId && statsByProperty[propId]) statsByProperty[propId].openDeficiencies += 1
      })
    }

    setStats(statsByProperty)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  const portfolioTotal = Object.values(stats).reduce((sum, s) => sum + s.total, 0)
  const portfolioOverdue = Object.values(stats).reduce((sum, s) => sum + s.overdue, 0)
  const portfolioDeficiencies = Object.values(stats).reduce((sum, s) => sum + s.openDeficiencies, 0)
  const portfolioCompliance = portfolioTotal > 0 ? Math.round(((portfolioTotal - portfolioOverdue) / portfolioTotal) * 100) : null

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Portfolio Compliance" />

        {noOrg && (
          <p className="mt-6 text-sm text-deck-dim">
            Your account isn't linked to an organization yet - contact an admin.
          </p>
        )}

        {!noOrg && properties.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">No properties in your portfolio yet.</p>
        )}

        {properties.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-deck-border bg-deck-surface p-3 text-center">
              <p className="text-xl font-semibold text-deck-text">
                {portfolioCompliance !== null ? `${portfolioCompliance}%` : '-'}
              </p>
              <p className="mt-0.5 text-[11px] text-deck-mute">Compliant</p>
            </div>
            <div className="rounded-xl border border-deck-border bg-deck-surface p-3 text-center">
              <p className="text-xl font-semibold text-deck-text">{portfolioOverdue}</p>
              <p className="mt-0.5 text-[11px] text-deck-mute">Overdue</p>
            </div>
            <div className="rounded-xl border border-deck-border bg-deck-surface p-3 text-center">
              <p className="text-xl font-semibold text-deck-text">{portfolioDeficiencies}</p>
              <p className="mt-0.5 text-[11px] text-deck-mute">Open deficiencies</p>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {properties.map((p) => {
            const s = stats[p.id] || { total: 0, overdue: 0, openDeficiencies: 0 }
            const pct = s.total > 0 ? Math.round(((s.total - s.overdue) / s.total) * 100) : null
            return (
              <div key={p.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                <Link href={`/fmiq/assets/${p.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-deck-text">{p.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        pct === null
                          ? 'bg-deck-raised text-deck-dim'
                          : pct === 100
                            ? 'bg-emerald-100 text-emerald-700'
                            : pct >= 70
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pct !== null ? `${pct}% compliant` : 'No schedule'}
                    </span>
                  </div>
                  {p.location && <p className="mt-0.5 text-xs text-deck-dim">{p.location}</p>}
                </Link>
                <div className="mt-1.5 flex items-center justify-between text-xs text-deck-mute">
                  <div className="flex gap-3">
                    <span>{s.overdue} overdue</span>
                    <span>{s.openDeficiencies} open deficienc{s.openDeficiencies === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <Link href={`/fmiq/portfolio/${p.id}/summary`} className="font-medium text-fmiq-accent underline">
                    Summary
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
