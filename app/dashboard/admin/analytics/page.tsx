'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import BarList from '@/components/charts/BarList'

type CompanyStats = {
  company_name: string
  totalDefects: number
  draft: number
  confirmed: number
  assigned: number
  pendingApproval: number
  closed: number
  rejected: number
  photoCount: number
  videoFrameCount: number
  totalCost: number
  activeUsers: number
}

export default function PlatformAnalyticsPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [totalCostAllTime, setTotalCostAllTime] = useState(0)

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
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_platform_admin) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)

    const { data: projects } = await supabase.from('projects').select('id, company_name')
    const { data: defects } = await supabase.from('defects').select('project_id, status')
    const { data: logs } = await supabase.from('analysis_log').select('company_name, kind, estimated_cost')
    const { data: users } = await supabase.from('profiles').select('company_name')

    const projectToCompany: Record<string, string> = {}
    ;(projects || []).forEach((p: any) => {
      projectToCompany[p.id] = p.company_name || 'Unassigned'
    })

    const companyMap: Record<string, CompanyStats> = {}

    function ensure(name: string) {
      if (!companyMap[name]) {
        companyMap[name] = {
          company_name: name,
          totalDefects: 0,
          draft: 0,
          confirmed: 0,
          assigned: 0,
          pendingApproval: 0,
          closed: 0,
          rejected: 0,
          photoCount: 0,
          videoFrameCount: 0,
          totalCost: 0,
          activeUsers: 0,
        }
      }
      return companyMap[name]
    }

    ;(defects || []).forEach((d: any) => {
      const name = projectToCompany[d.project_id] || 'Unassigned'
      const c = ensure(name)
      c.totalDefects++
      if (d.status === 'draft') c.draft++
      if (d.status === 'confirmed') c.confirmed++
      if (d.status === 'assigned') c.assigned++
      if (d.status === 'pending_approval') c.pendingApproval++
      if (d.status === 'closed') c.closed++
      if (d.status === 'rejected') c.rejected++
    })

    let allTimeCost = 0
    ;(logs || []).forEach((l: any) => {
      const name = l.company_name || 'Unassigned'
      const c = ensure(name)
      if (l.kind === 'photo') c.photoCount++
      if (l.kind === 'video_frame') c.videoFrameCount++
      c.totalCost += l.estimated_cost || 0
      allTimeCost += l.estimated_cost || 0
    })
    setTotalCostAllTime(allTimeCost)

    ;(users || []).forEach((u: any) => {
      const name = u.company_name || 'Unassigned'
      const c = ensure(name)
      c.activeUsers++
    })

    setCompanies(Object.values(companyMap).sort((a, b) => b.totalDefects - a.totalDefects))
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">You don't have access to this page.</p>
      </div>
    )
  }

  const backlogRows = companies
    .map((c) => ({
      key: c.company_name,
      label: c.company_name,
      value: c.draft + c.confirmed + c.assigned + c.pendingApproval,
      colorClass: 'bg-status-assigned',
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <PageHeader title="Platform Analytics" />
        <p className="mt-1 text-sm text-deck-dim">Usage, engagement, and AI cost across every company.</p>

        <div className="mt-4 rounded-xl bg-brand-ink p-4 text-white">
          <p className="text-2xl font-semibold">${totalCostAllTime.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-white/70">Total estimated AI cost, all time</p>
        </div>

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Backlog by company</h2>
          <p className="mt-0.5 text-xs text-deck-dim">Open defects (draft, confirmed, assigned or pending approval) not yet closed out.</p>
          <div className="mt-3">
            <BarList rows={backlogRows} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {companies.map((c) => (
            <div key={c.company_name} className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-deck-text">{c.company_name}</p>
                <span className="text-xs text-deck-dim">{c.activeUsers} users</span>
              </div>

              <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                <div>
                  <p className="text-sm font-semibold text-deck-dim">{c.draft}</p>
                  <p className="text-[10px] text-deck-dim">Draft</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600">{c.confirmed}</p>
                  <p className="text-[10px] text-deck-dim">Confirmed</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700">{c.assigned}</p>
                  <p className="text-[10px] text-deck-dim">Assigned</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{c.closed}</p>
                  <p className="text-[10px] text-deck-dim">Closed</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-600">{c.rejected}</p>
                  <p className="text-[10px] text-deck-dim">Rejected</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-deck-border pt-2 text-xs text-deck-dim">
                <span>{c.photoCount} photos · {c.videoFrameCount} video frames analyzed</span>
                <span className="font-medium text-deck-body">${c.totalCost.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

