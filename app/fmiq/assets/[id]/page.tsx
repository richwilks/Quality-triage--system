'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Asset = { id: string; name: string; location: string | null; notes: string | null; status: string }
type WorkOrder = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-blue-500/15 text-blue-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-white/10 text-deck-dim',
}

export default function AssetDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const assetId = params.id as string

  const [asset, setAsset] = useState<Asset | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [assetId])

  async function load() {
    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, notes, status')
      .eq('id', assetId)
      .single()
    setAsset(assetData)

    const { data: woData } = await supabase
      .from('fmiq_work_orders')
      .select('id, title, status, priority, due_date')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    setWorkOrders(woData || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Asset not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={asset.name} />
        {asset.location && <p className="mt-1 text-sm text-deck-dim">{asset.location}</p>}
        {asset.notes && <p className="mt-1 text-xs text-deck-dim">{asset.notes}</p>}

        <div className="mt-6">
          <Link
            href={`/fmiq/work-orders/new?assetId=${assetId}`}
            className="inline-block rounded-md bg-fmiq-accent px-4 py-2 text-sm font-medium text-deck-bg"
          >
            + New task for this asset
          </Link>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">Tasks</h2>

        {workOrders.length === 0 && (
          <p className="mt-2 text-sm text-deck-dim">No tasks logged yet.</p>
        )}

        <div className="mt-2 space-y-2">
          {workOrders.map((w) => (
            <Link
              key={w.id}
              href={`/fmiq/work-orders/${w.id}`}
              className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-deck-text">{w.title}</p>
                {w.due_date && <p className="text-xs text-deck-dim">Due {w.due_date}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[w.status] || STATUS_COLOR.open}`}>
                {STATUS_LABEL[w.status] || w.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
