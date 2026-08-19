'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useBranding } from '@/components/BrandingContext'

type Asset = { id: string; name: string; location: string | null; status: string }
type StatusCounts = Record<string, number>

const STATUS_ORDER = ['open', 'in_progress', 'completed', 'cancelled']
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'text-amber-700',
  in_progress: 'text-blue-600',
  completed: 'text-emerald-700',
  cancelled: 'text-deck-mute',
}

export default function FMIQHomePage() {
  const supabase = createClient()
  const branding = useBranding()
  const [assets, setAssets] = useState<Asset[]>([])
  const [counts, setCounts] = useState<Record<string, StatusCounts>>({})
  const [loading, setLoading] = useState(true)

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
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_name) {
      setLoading(false)
      return
    }

    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, status')
      .eq('company_name', profile.company_name)
      .order('created_at', { ascending: false })
    setAssets(assetData || [])

    if (assetData && assetData.length > 0) {
      const { data: woData } = await supabase
        .from('fmiq_work_orders')
        .select('asset_id, status')
        .eq('company_name', profile.company_name)

      const grouped: Record<string, StatusCounts> = {}
      assetData.forEach((a) => {
        grouped[a.id] = {}
      })
      ;(woData || []).forEach((w) => {
        if (!grouped[w.asset_id]) grouped[w.asset_id] = {}
        grouped[w.asset_id][w.status] = (grouped[w.asset_id][w.status] || 0) + 1
      })
      setCounts(grouped)
    }

    setLoading(false)
  }

  const totalOpen = Object.values(counts).reduce(
    (sum, c) => sum + (c.open || 0) + (c.in_progress || 0),
    0
  )

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
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-fmiq-accent font-mono text-xs font-bold text-deck-bg">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.companyName || 'Logo'} className="h-full w-full object-contain" />
              ) : (
                'FM'
              )}
            </div>
            <h1 className="text-xl font-semibold text-deck-text">
              {branding.hideDefaultBrand && branding.companyName ? branding.companyName : 'FMIQ'}
            </h1>
          </div>
          <Link href="/choose" className="text-xs font-medium text-deck-dim underline">
            Switch system
          </Link>
        </div>
        <p className="mt-1 text-sm text-deck-dim">Property inspections, compliance &amp; maintenance.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Properties</p>
            <p className="mt-1 text-2xl font-semibold text-deck-text">{assets.length}</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-deck-mute">Open tasks</p>
            <p className="mt-1 text-2xl font-semibold text-deck-text">{totalOpen}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/fmiq/inspections/new"
            className="flex-1 rounded-md bg-fmiq-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
          >
            + New inspection
          </Link>
          <Link
            href="/fmiq/assets/new"
            className="flex-1 rounded-md border border-deck-border px-4 py-2 text-center text-sm font-medium text-deck-text"
          >
            + New property
          </Link>
        </div>

        <div className="mt-5">
          <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-deck-dim">Quick Access</h2>
          <div className="overflow-hidden rounded-md border border-deck-border">
            <Link
              href="/fmiq/compliance"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Compliance Tasks</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/notifications"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Notifications</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/portfolio"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Portfolio Compliance</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/regulations"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Regulations Library</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/economic-reports"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Economic Reports</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/reports/asset-condition-example"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Asset Condition Report (example)</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/checklists"
              className="flex items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Checklist Templates</span>
              <span className="text-deck-mute">→</span>
            </Link>
            <Link
              href="/fmiq/settings"
              className="flex items-center justify-between bg-deck-surface px-3.5 py-3 text-[13.5px] font-medium text-deck-text"
            >
              <span>Settings &amp; Branding</span>
              <span className="text-deck-mute">→</span>
            </Link>
          </div>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Properties</h2>

        {assets.length === 0 && (
          <p className="mt-2 text-sm text-deck-dim">
            No properties yet.{' '}
            <Link href="/fmiq/assets/new" className="font-medium text-fmiq-accent underline">
              Add your first one
            </Link>
            .
          </p>
        )}

        <div className="mt-2 space-y-2">
          {assets.map((a) => {
            const assetCounts = counts[a.id] || {}
            const total = Object.values(assetCounts).reduce((sum, c) => sum + c, 0)
            return (
              <Link
                key={a.id}
                href={`/fmiq/assets/${a.id}`}
                className="block rounded-lg border border-deck-border bg-deck-surface p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-deck-text">{a.name}</p>
                  <span className="text-xs text-deck-mute">{total} task{total === 1 ? '' : 's'}</span>
                </div>
                {a.location && <p className="mt-0.5 text-xs text-deck-dim">{a.location}</p>}
                {total > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STATUS_ORDER.filter((s) => assetCounts[s] > 0).map((s) => (
                      <span key={s} className={`text-xs font-medium ${STATUS_COLOR[s]}`}>
                        {assetCounts[s]} {STATUS_LABEL[s]}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
