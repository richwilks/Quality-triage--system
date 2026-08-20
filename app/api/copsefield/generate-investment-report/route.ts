import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvestmentReport, FindingSummary, EconomicReportExcerpt } from '@/lib/anthropic'

export const maxDuration = 60

function priorityToSeverity(priority: number | null): string {
  if (priority === null) return 'moderate'
  if (priority >= 9) return 'hazard'
  if (priority >= 7) return 'major'
  if (priority >= 5) return 'moderate'
  return 'minor'
}

export async function POST(req: NextRequest) {
  try {
    const { buildingId } = await req.json()

    const supabase = await createClient()
    const { data: building } = await supabase
      .from('copsefield_buildings')
      .select('id, name, address, building_type')
      .eq('id', buildingId)
      .single()

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 })
    }

    const { data: openTicketsData } = await supabase
      .from('copsefield_tickets')
      .select('observation, recommendation, priority, planning_allowance_low, planning_allowance_high')
      .eq('building_id', buildingId)
      .not('status', 'in', '(actioned,deferred)')

    const findings: FindingSummary[] = (openTicketsData || []).map((t) => ({
      description: [t.observation, t.recommendation].filter(Boolean).join(' - ') || 'Outstanding item',
      severity: priorityToSeverity(t.priority),
      regulation_reference: null,
      estimated_cost_min: t.planning_allowance_low,
      estimated_cost_max: t.planning_allowance_high,
    }))

    const { data: pastInspections } = await supabase
      .from('copsefield_inspections')
      .select('visit_date, notes, status')
      .eq('building_id', buildingId)
      .eq('status', 'completed')
      .order('visit_date', { ascending: false })
      .limit(10)

    const pastInspectionSummaries = (pastInspections || []).map(
      (i) => `- ${i.visit_date}${i.notes ? `: ${i.notes}` : ''}`
    )

    const { data: economicReportsData } = await supabase
      .from('copsefield_economic_reports')
      .select('title, category, extracted_text, summary')
      .not('extracted_text', 'is', null)
      .limit(20)

    const economicReports: EconomicReportExcerpt[] = (economicReportsData || []).map((r) => ({
      title: r.title,
      category: r.category,
      text: r.summary || r.extracted_text,
    }))

    const content = await generateInvestmentReport(
      building.name,
      building.address,
      building.building_type,
      findings,
      pastInspectionSummaries,
      economicReports
    )

    const { data: report, error: insertError } = await supabase
      .from('copsefield_property_reports')
      .insert({
        building_id: building.id,
        report_type: 'investment',
        title: `Property Report - ${building.name}`,
        content,
      })
      .select()
      .single()

    if (insertError || !report) {
      return NextResponse.json({ error: insertError?.message || 'Could not save report' }, { status: 500 })
    }

    return NextResponse.json({ reportId: report.id })
  } catch (err) {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
