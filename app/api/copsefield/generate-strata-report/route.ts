import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStrataDueDiligenceReport, ConditionFinding } from '@/lib/anthropic'

export const maxDuration = 90

const LEGAL_NOTICE = `

---

IMPORTANT LEGAL / SCOPE NOTE

This is a buyer due-diligence template, not a statutory certificate and not legal, engineering, insurance or financial advice. For a British Columbia strata, the statutory Form B must be obtained in the prescribed form. The Form B is accompanied by required documents including the current budget, rules and most recent depreciation report where obtained. Requirements differ between Canadian provinces; adapt the template to the province governing the property. Fields marked "Not provided" reflect the absence of a supporting source document at the time this report was generated, not a confirmed absence of that risk.`

export async function POST(req: NextRequest) {
  try {
    const { buildingId } = await req.json()

    const supabase = await createClient()
    const { data: building } = await supabase
      .from('copsefield_buildings')
      .select('id, name, address, building_code, strata_report_text')
      .eq('id', buildingId)
      .single()

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 })
    }

    const { data: ticketData } = await supabase
      .from('copsefield_tickets')
      .select('asset_category, component, location, observation, recommendation, priority, status, planning_allowance_low, planning_allowance_high')
      .eq('building_id', buildingId)
      .order('priority', { ascending: false })

    const findings: ConditionFinding[] = ticketData || []

    const content = await generateStrataDueDiligenceReport(
      building.name,
      building.address,
      building.building_code,
      building.strata_report_text,
      findings
    )

    const { data: report, error: insertError } = await supabase
      .from('copsefield_property_reports')
      .insert({
        building_id: building.id,
        report_type: 'strata_due_diligence',
        title: `Strata Due Diligence Report - ${building.name}`,
        content: content + LEGAL_NOTICE,
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
