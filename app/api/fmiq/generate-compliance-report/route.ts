import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateComplianceReport, FindingSummary } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { inspectionId } = await req.json()

    const supabase = await createClient()
    const { data: inspection } = await supabase
      .from('fmiq_inspections')
      .select('id, asset_id, company_name, inspection_date, fmiq_assets(name, location)')
      .eq('id', inspectionId)
      .single()

    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
    }

    const asset = Array.isArray(inspection.fmiq_assets) ? inspection.fmiq_assets[0] : inspection.fmiq_assets

    const { data: findingsData } = await supabase
      .from('fmiq_inspection_findings')
      .select('description, severity, regulation_reference, estimated_cost_min, estimated_cost_max')
      .eq('inspection_id', inspectionId)

    const findings: FindingSummary[] = (findingsData || []).map((f) => ({
      description: f.description || '',
      severity: f.severity,
      regulation_reference: f.regulation_reference,
      estimated_cost_min: f.estimated_cost_min,
      estimated_cost_max: f.estimated_cost_max,
    }))

    const content = await generateComplianceReport(
      asset?.name || 'Property',
      asset?.location || null,
      inspection.inspection_date,
      findings
    )

    const totalMin = findings.reduce((sum, f) => sum + (f.estimated_cost_min || 0), 0)
    const totalMax = findings.reduce((sum, f) => sum + (f.estimated_cost_max || 0), 0)
    const hasEstimates = findings.some((f) => f.estimated_cost_min !== null)

    const { data: report, error: insertError } = await supabase
      .from('fmiq_property_reports')
      .insert({
        asset_id: inspection.asset_id,
        inspection_id: inspection.id,
        company_name: inspection.company_name,
        report_type: 'compliance',
        title: `Compliance Report - ${asset?.name || 'Property'} - ${inspection.inspection_date}`,
        content,
        total_estimated_cost_min: hasEstimates ? totalMin : null,
        total_estimated_cost_max: hasEstimates ? totalMax : null,
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
