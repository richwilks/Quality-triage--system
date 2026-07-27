import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, ExtraStandardText, FeedbackExample } from '@/lib/anthropic'

export const maxDuration = 30
const MAX_FEEDBACK_EXAMPLES = 12

// Sonnet 5 pricing per 1M tokens (adjust if pricing changes)
const INPUT_COST_PER_M = 2.0
const OUTPUT_COST_PER_M = 10.0

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId, location, finishGrade } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, standards, spec_extracted_text, company_name')
      .eq('id', projectId)
      .single()

    const extraStandards: ExtraStandardText[] = []
    if (project?.standards) {
      const { data: library } = await supabase
        .from('standards_library')
        .select('code, extracted_text')

      const matches = (library || []).filter(
        (s) => s.extracted_text && project.standards.toLowerCase().includes(s.code.toLowerCase())
      )

      matches.forEach((m) => extraStandards.push({ code: m.code, text: m.extracted_text }))
    }

    let feedbackExamples: FeedbackExample[] = []
    if (project?.company_name) {
      const { data: history } = await supabase
        .from('defect_history')
        .select('new_status, notes, defects(description, ai_description, project_id, projects(company_name))')
        .in('new_status', ['confirmed', 'rejected'])
        .order('changed_at', { ascending: false })
        .limit(30)

      const relevant = (history || [])
        .filter((h: any) => {
          const d = Array.isArray(h.defects) ? h.defects[0] : h.defects
          return d?.project_id === projectId
        })
        .slice(0, MAX_FEEDBACK_EXAMPLES)

      feedbackExamples = relevant.map((h: any) => {
        const d = Array.isArray(h.defects) ? h.defects[0] : h.defects
        return {
          description: d?.description || d?.ai_description || 'unknown defect',
          wasValid: h.new_status === 'confirmed',
          reason: h.new_status === 'rejected' ? h.notes : null,
        }
      })
    }

    const { defects, usage } = await analyzeDefectImage(
      imageBase64,
      mimeType,
      project?.description || '',
      project?.standards || '',
      location || null,
      project?.spec_extracted_text || null,
      extraStandards,
      feedbackExamples,
      finishGrade || null
    )

    if (usage) {
      const cost =
        (usage.input_tokens / 1_000_000) * INPUT_COST_PER_M +
        (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M

      await supabase.from('analysis_log').insert({
        project_id: projectId,
        company_name: project?.company_name || null,
        kind: 'photo',
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        estimated_cost: cost,
      })
    }

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
