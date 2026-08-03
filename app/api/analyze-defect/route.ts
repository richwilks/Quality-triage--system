import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, ExtraStandardText, FeedbackExample, KnowledgeEntry } from '@/lib/anthropic'

export const maxDuration = 60
const MAX_FEEDBACK_EXAMPLES = 12

// Sonnet 5 pricing per 1M tokens (adjust if pricing changes)
const INPUT_COST_PER_M = 2.0
const OUTPUT_COST_PER_M = 10.0

function normalizeCode(code: string) {
  return code.toLowerCase().replace(/[\s.\-_/]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId, location, finishGrade } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, standards, spec_extracted_text, company_name, country')
      .eq('id', projectId)
      .single()

    // Pull all project specs (concrete, sub station, drainage, etc) and combine them
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
      combinedSpecText = combinedSpecText
        ? `${combinedSpecText}\n\n${specSections}`
        : specSections
    }

    const extraStandards: ExtraStandardText[] = []
    if (project?.standards) {
      const { data: library } = await supabase
        .from('standards_library')
        .select('code, extracted_text')

      const projectStandardsNormalized = normalizeCode(project.standards)

      const matches = (library || []).filter((s) => {
        if (!s.extracted_text || !s.code) return false
        const codeNormalized = normalizeCode(s.code)
        return projectStandardsNormalized.includes(codeNormalized)
      })

      matches.forEach((m) => extraStandards.push({ code: m.code, text: m.extracted_text }))
    }

    // Pull master defect knowledge base entries relevant to this project's country/standards
    const knowledgeEntries: KnowledgeEntry[] = []
    const { data: knowledgeRows } = await supabase
      .from('defect_knowledge_base')
      .select('title, element_type, country, applicable_standards, defect_description, correct_reference')
      .eq('active', true)

    if (knowledgeRows) {
      const projectCountry = (project?.country || 'UK').toLowerCase().trim()
      const projectStandardsNormalized = project?.standards ? normalizeCode(project.standards) : ''

      const relevantEntries = knowledgeRows.filter((k) => {
        const countryMatches = !k.country || k.country.toLowerCase().trim() === projectCountry
        const standardsMatch =
          !k.applicable_standards ||
          !projectStandardsNormalized ||
          projectStandardsNormalized.includes(normalizeCode(k.applicable_standards))
        // Include if country matches AND (no standards restriction OR standards match)
        return countryMatches && (!k.applicable_standards || standardsMatch)
      })

      relevantEntries.forEach((k) =>
        knowledgeEntries.push({
          title: k.title,
          elementType: k.element_type,
          defectDescription: k.defect_description,
          correctReference: k.correct_reference,
        })
      )
    }

    console.log('Combined spec length:', combinedSpecText?.length || 0)
    console.log('Extra standards loaded:', extraStandards.map((s) => s.code))
    console.log('Knowledge entries loaded:', knowledgeEntries.map((k) => k.title))

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
      combinedSpecText || null,
      extraStandards,
      feedbackExamples,
      finishGrade || null,
      knowledgeEntries
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
