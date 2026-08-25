import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, classifyElementType, ExtraStandardText, FeedbackExample, KnowledgeEntry, OrientationHint } from '@/lib/anthropic'

export const maxDuration = 60
const MAX_FEEDBACK_EXAMPLES = 12
const MAX_KNOWLEDGE_PHOTOS = 6
// Entries can now grow automatically (every confirmed defect adds one), so
// this bounds prompt size/cost/latency - most recent entries first, since
// they best reflect current work.
const MAX_KNOWLEDGE_ENTRIES = 50

// Sonnet 5 pricing per 1M tokens (adjust if pricing changes)
const INPUT_COST_PER_M = 2.0
const OUTPUT_COST_PER_M = 10.0

function normalizeCode(code: string) {
  return code.toLowerCase().replace(/[\s.\-_/]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const {
      imageBase64,
      mimeType,
      projectId,
      location,
      finishGrade,
      orientationHint,
    }: {
      imageBase64: string
      mimeType: string
      projectId: string
      location?: string
      finishGrade?: string
      orientationHint?: OrientationHint | null
    } = await req.json()

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

    // Cheap pre-classification so the reference material below (knowledge base,
    // past feedback) can be filtered to the same element type as this photo,
    // instead of potentially mixing in irrelevant history from a different kind
    // of element. This only classifies what's in the photo, not whether
    // anything is a defect - the actual defect judgement stays a single call.
    let classifiedElementType: string | null = null
    let classifyUsage: { input_tokens: number; output_tokens: number } | null = null
    try {
      const classified = await classifyElementType(imageBase64, mimeType, orientationHint || null)
      classifiedElementType = classified.elementType
      classifyUsage = classified.usage
    } catch {
      // Classification is a soft filter, not a gate - fall back to unfiltered
      // reference material (previous behaviour) if it fails for any reason.
    }

    // Pull master defect knowledge base entries relevant to this project's country/standards
    const knowledgeEntries: KnowledgeEntry[] = []
    const { data: knowledgeRows } = await supabase
      .from('defect_knowledge_base')
      .select('title, element_type, country, applicable_standards, defect_description, correct_reference, photo_url')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(MAX_KNOWLEDGE_ENTRIES)

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
        if (!countryMatches || (k.applicable_standards && !standardsMatch)) return false
        // Drop entries tagged for a clearly different element type than this photo was
        // classified as (e.g. a floor-finish entry when this photo is a fire-stopping
        // seal) - entries with no element_type set stay in (fail open on missing data).
        if (classifiedElementType && k.element_type && k.element_type !== classifiedElementType) return false
        return true
      })

      let photosFetched = 0
      for (const k of relevantEntries) {
        let photoBase64: string | null = null
        let photoMimeType: string | null = null

        if (k.photo_url && photosFetched < MAX_KNOWLEDGE_PHOTOS) {
          try {
            const photoRes = await fetch(k.photo_url)
            if (photoRes.ok) {
              const buffer = await photoRes.arrayBuffer()
              photoBase64 = Buffer.from(buffer).toString('base64')
              photoMimeType = photoRes.headers.get('content-type') || 'image/jpeg'
              photosFetched++
            }
          } catch {
            // Reference photo fetch failed - fall back to text-only for this entry.
          }
        }

        knowledgeEntries.push({
          title: k.title,
          elementType: k.element_type,
          defectDescription: k.defect_description,
          correctReference: k.correct_reference,
          photoBase64,
          photoMimeType,
        })
      }
    }

    console.log('Combined spec length:', combinedSpecText?.length || 0)
    console.log('Extra standards loaded:', extraStandards.map((s) => s.code))
    console.log('Knowledge entries loaded:', knowledgeEntries.map((k) => k.title))

    let feedbackExamples: FeedbackExample[] = []
    if (project?.company_name) {
      const { data: history, error: historyError } = await supabase
        .from('defect_history')
        .select('new_status, notes, defects(description, ai_description, project_id, element_type, projects(company_name))')
        .in('new_status', ['confirmed', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(80)
      if (historyError) {
        console.error('Failed to load defect_history feedback examples:', historyError)
      }

      const relevant = (history || [])
        .filter((h: any) => {
          const d = Array.isArray(h.defects) ? h.defects[0] : h.defects
          if (d?.project_id !== projectId) return false
          // Same fail-open rule as the knowledge base filter above: only drop an
          // example when we're confident about both this photo's element type and
          // the past example's - otherwise keep it rather than risk losing context.
          if (classifiedElementType && d?.element_type && d.element_type !== classifiedElementType) return false
          return true
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
      knowledgeEntries,
      orientationHint || null
    )

    if (usage) {
      const totalInputTokens = usage.input_tokens + (classifyUsage?.input_tokens || 0)
      const totalOutputTokens = usage.output_tokens + (classifyUsage?.output_tokens || 0)
      const cost =
        (totalInputTokens / 1_000_000) * INPUT_COST_PER_M +
        (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_M

      await supabase.from('analysis_log').insert({
        project_id: projectId,
        company_name: project?.company_name || null,
        kind: 'photo',
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        estimated_cost: cost,
      })
    }

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
