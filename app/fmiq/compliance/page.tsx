'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type ScheduledInspection = {
  id: string
  due_date: string
  status: string
  fmiq_assets: { name: string; location: string | null } | { name: string; location: string | null }[] | null
  fmiq_inspection_frameworks:
    | { system_type: string; reference_standard: string }
    | { system_type: string; reference_standard: string }[]
    | null
}

const SYSTEM_LABEL: Record<string, string> = {
  fire_alarm: 'Fire alarm',
  sprinkler: 'Sprinkler',
  extinguisher: 'Extinguisher',
  emergency_lighting: 'Emergency lighting',
  elevator: 'Elevator',
  backflow: 'Backflow prevention',
  generator: 'Generator',
  other: 'Other',
}

export default function ComplianceTaskListPage() {
  const supabase = createClient()
  const [tasks, setTasks] = useState<ScheduledInspection[]>([])
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

    const { data } = await supabase
      .from('fmiq_scheduled_inspections')
      .select('id, due_date, status, fmiq_assets(name, location), fmiq_inspection_frameworks(system_type, reference_standard)')
      .eq('assigned_contractor_org_id', profile.org_id)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })

    setTasks((data as unknown as ScheduledInspection[]) || [])
    setLoading(false)
  }

  function getAsset(t: ScheduledInspection) {
    if (!t.fmiq_assets) return null
    return Array.isArray(t.fmiq_assets) ? t.fmiq_assets[0] : t.fmiq_assets
  }

  function getFramework(t: ScheduledInspection) {
    if (!t.fmiq_inspection_frameworks) return null
    return Array.isArray(t.fmiq_inspection_frameworks) ? t.fmiq_inspection_frameworks[0] : t.fmiq_inspection_frameworks
  }

  function isOverdue(t: ScheduledInspection) {
    return new Date(t.due_date) < new Date(new Date().toDateString())
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
        <PageHeader title="Compliance Tasks" />
        <p className="mt-1 text-sm text-deck-dim">Inspections assigned to your organization.</p>

        {noOrg && (
          <p className="mt-4 text-sm text-deck-dim">
            Your account isn't linked to an organization yet - contact an admin.
          </p>
        )}

        {!noOrg && tasks.length === 0 && (
          <p className="mt-4 text-sm text-deck-dim">No compliance inspections assigned to you right now.</p>
        )}

        <div className="mt-4 space-y-2">
          {tasks.map((t) => {
            const asset = getAsset(t)
            const framework = getFramework(t)
            const overdue = isOverdue(t)
            return (
              <Link
                key={t.id}
                href={`/fmiq/compliance/${t.id}`}
                className="block rounded-lg border border-deck-border bg-deck-surface p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-deck-text">{asset?.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      overdue ? 'bg-red-100 text-red-700' : 'bg-deck-raised text-deck-dim'
                    }`}
                  >
                    {overdue ? 'Overdue' : 'Upcoming'}
                  </span>
                </div>
                {asset?.location && <p className="mt-0.5 text-xs text-deck-dim">{asset.location}</p>}
                <p className="mt-1.5 text-xs text-deck-body">
                  {framework ? SYSTEM_LABEL[framework.system_type] || framework.system_type : ''}
                  {framework?.reference_standard ? ` · ${framework.reference_standard}` : ''}
                </p>
                <p className="mt-1 text-xs text-deck-mute">Due {t.due_date}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
