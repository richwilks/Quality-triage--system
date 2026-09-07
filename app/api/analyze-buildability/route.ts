import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeBuildabilityDrawing } from '@/lib/anthropic'
import { BUILDABILITY_CHECKLIST } from '@/lib/buildabilityChecklist'

export const maxDuration = 60

// Sonnet 5 pricing per 1M tokens (adjust if pricing changes)
const INPUT_COST_PER_M = 2.0
const OUTPUT_COST_PER_M = 10.0

export async function POST(req: NextRequest) {
  try {
    const {
      drawingBase64,
      mediaType,
      kind,
      projectId,
    }: {
      drawingBase64: string
      mediaType: string
      kind: 'image' | 'document'
      projectId: string
    } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, spec_extracted_text, company_name')
      .eq('id', projectId)
      .single()

    const { data: projectSpecs } = await supabase
      .from('project_specs')
      .select('name, extracted_text')
      .eq('project_id', projectId)
      .not('extracted_text', 'is', null)

    let combinedSpecText = project?.spec_extracted_text || ''
    if (projectSpecs && projectSpecs.length > 0) {
      const specSections = projectSpecs
        .filter((s) => s.extracted_text)
        .map((s) => `--- ${s.name || 'Specification'} ---\n${s.extracted_text}`)
        .join('\n\n')
      combinedSpecText = combinedSpecText ? `${combinedSpecText}\n\n${specSections}` : specSections
    }

    const { findings, usage } = await analyzeBuildabilityDrawing(
      { base64: drawingBase64, mediaType, kind },
      project?.description || '',
      combinedSpecText || null,
      BUILDABILITY_CHECKLIST
    )

    if (usage) {
      const cost = (usage.input_tokens / 1_000_000) * INPUT_COST_PER_M + (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M
      await supabase.from('analysis_log').insert({
        project_id: projectId,
        company_name: project?.company_name || null,
        kind: 'buildability_drawing',
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        estimated_cost: cost,
      })
    }

    return NextResponse.json({ findings })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
