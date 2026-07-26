import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, ExtraStandardText, FeedbackExample } from '@/lib/anthropic'

export const maxDuration = 30
const MAX_FEEDBACK_EXAMPLES = 8

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId, location } = await req.json()

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
          const proj = d?.projects ? (Array.isArray(d.projects) ? d.projects[0] : d.projects) : null
          return proj?.company_name?.toLowerCase() === project.company_name.toLowerCase()
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

    const defects = await analyzeDefectImage(
      imageBase64,
      mimeType,
      project?.description || '',
      project?.standards || '',
      location || null,
      project?.spec_extracted_text || null,
      extraStandards,
      feedbackExamples
    )

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
