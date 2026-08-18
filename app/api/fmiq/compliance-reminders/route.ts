import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 60

type ScheduledRow = {
  id: string
  property_id: string
  due_date: string
  assigned_contractor_org_id: string | null
  fmiq_assets: { name: string } | { name: string }[] | null
  fmiq_inspection_frameworks: { system_type: string } | { system_type: string }[] | null
}

function daysUntil(dueDate: string, today: Date): number {
  const due = new Date(dueDate)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  const today = new Date(new Date().toDateString())

  const { data: scheduled, error: fetchError } = await supabase
    .from('fmiq_scheduled_inspections')
    .select(
      'id, property_id, due_date, assigned_contractor_org_id, fmiq_assets(name), fmiq_inspection_frameworks(system_type)'
    )
    .eq('status', 'upcoming')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let notificationsCreated = 0
  const overdueIds: string[] = []

  for (const s of (scheduled || []) as unknown as ScheduledRow[]) {
    const diff = daysUntil(s.due_date, today)
    let threshold: '30_day' | '14_day' | '7_day' | 'overdue' | null = null
    if (diff < 0) threshold = 'overdue'
    else if (diff === 7) threshold = '7_day'
    else if (diff === 14) threshold = '14_day'
    else if (diff === 30) threshold = '30_day'
    if (!threshold) continue

    const asset = Array.isArray(s.fmiq_assets) ? s.fmiq_assets[0] : s.fmiq_assets
    const framework = Array.isArray(s.fmiq_inspection_frameworks)
      ? s.fmiq_inspection_frameworks[0]
      : s.fmiq_inspection_frameworks
    const systemLabel = (framework?.system_type || 'inspection').replace('_', ' ')
    const propertyName = asset?.name || 'a property'

    const message =
      threshold === 'overdue'
        ? `${systemLabel} inspection for ${propertyName} is overdue (was due ${s.due_date}).`
        : `${systemLabel} inspection for ${propertyName} is due in ${diff} day${diff === 1 ? '' : 's'} (${s.due_date}).`

    const { data: accessRows } = await supabase
      .from('fmiq_property_access')
      .select('org_id')
      .eq('property_id', s.property_id)

    const recipientOrgIds = new Set<string>((accessRows || []).map((a: { org_id: string }) => a.org_id))
    if (s.assigned_contractor_org_id) recipientOrgIds.add(s.assigned_contractor_org_id)
    if (recipientOrgIds.size === 0) continue

    const rows = Array.from(recipientOrgIds).map((orgId) => ({
      org_id: orgId,
      scheduled_inspection_id: s.id,
      threshold,
      message,
    }))

    const { error: upsertError } = await supabase
      .from('fmiq_notifications')
      .upsert(rows, { onConflict: 'org_id,scheduled_inspection_id,threshold', ignoreDuplicates: true })

    if (!upsertError) notificationsCreated += rows.length
    if (threshold === 'overdue') overdueIds.push(s.id)
  }

  if (overdueIds.length > 0) {
    await supabase.from('fmiq_scheduled_inspections').update({ status: 'overdue' }).in('id', overdueIds)
  }

  return NextResponse.json({
    scanned: (scheduled || []).length,
    notificationsCreated,
    markedOverdue: overdueIds.length,
  })
}
