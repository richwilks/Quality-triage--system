import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvestmentReport, FindingSummary, EconomicReportExcerpt } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json()

    const supabase = await createClient()
    const { data: asset } = await supabase
      .from('fmiq_assets')
      .select('id, name, location, property_type, company_name')
      .eq('id', assetId)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: openFindingsData } = await supabase
      .from('fmiq_inspection_findings')
      .select('description, severity, regulation_reference, estimated_cost_min, estimated_cost_max')
      .eq('asset_id', assetId)
      .eq('status', 'open')

    const findings: FindingSummary[] = (openFindingsData || []).map((f) => ({
      description: f.description || '',
      severity: f.severity,
      regulation_reference: f.regulation_reference,
      estimated_cost_min: f.estimated_cost_min,
      estimated_cost_max: f.estimated_cost_max,
    }))

    const { data: pastInspections } = await supabase
      .from('fmiq_inspections')
      .select('inspection_date, notes, status')
      .eq('asset_id', assetId)
      .eq('status', 'completed')
      .order('inspection_date', { ascending: false })
      .limit(10)

    const pastInspectionSummaries = (pastInspections || []).map(
      (i) => `- ${i.inspection_date}${i.notes ? `: ${i.notes}` : ''}`
    )

    const { data: economicReportsData } = await supabase
      .from('fmiq_economic_reports')
      .select('title, category, extracted_text')
      .not('extracted_text', 'is', null)
      .limit(20)

    const economicReports: EconomicReportExcerpt[] = (economicReportsData || []).map((r) => ({
      title: r.title,
      category: r.category,
      text: r.extracted_text,
    }))

    const content = await generateInvestmentReport(
      asset.name,
      asset.location,
      asset.property_type,
      findings,
      pastInspectionSummaries,
      economicReports
    )

    const { data: report, error: insertError } = await supabase
      .from('fmiq_property_reports')
      .insert({
        asset_id: asset.id,
        inspection_id: null,
        company_name: asset.company_name,
        report_type: 'investment',
        title: `Investment Return Report - ${asset.name}`,
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
