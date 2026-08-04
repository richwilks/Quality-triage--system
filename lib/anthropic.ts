export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  requires_measurement: boolean
  box: { x: number; y: number; width: number; height: number }
}

export type ExtraStandardText = { code: string; text: string }
export type FeedbackExample = { description: string; wasValid: boolean; reason?: string | null }
export type KnowledgeEntry = {
  title: string
  elementType: string | null
  defectDescription: string
  correctReference: string | null
}
export type BoundaryPoint = { x: number; y: number }

export async function extractDocumentText(base64Doc: string, label: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Doc },
            },
            {
              type: 'text',
              text: `This document is "${label}". Extract and summarise, in plain text, every testable requirement, tolerance, clause number, material spec, and defect criterion a site inspector would need to check work against. Be thorough but concise - this will be reused for every future inspection, so don't omit anything that could matter, but don't pad with commentary. Preserve the exact part number and section/clause numbering from the source document wherever present (e.g. "Part 1, Section 10.3") - this precision matters for future citation, so never paraphrase away a numbered reference.

CRITICAL - Figures and diagrams: If the document contains any figures, diagrams, cross-sections, or photos showing correct vs incorrect installation, correct component positioning, or assembly detail, describe IN DETAIL what each one shows - as if describing it to someone who cannot see it and needs to visually verify a real installation matches it. Include: what components are visible, their correct relative position to each other, what should be covered/concealed vs exposed, any visible gaps/reveals and their approximate proportions, orientation, and any labels or callouts on the figure. State the figure number/reference (e.g. "Fig 4") so it can be cited later. This visual detail is often more important than surrounding text for spotting real-world installation defects, so do not skip or summarise figures briefly - describe them as thoroughly as the written clauses.

Output plain text only, organised by clause/section where possible, with figure descriptions placed immediately after the clause they illustrate.`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  console.log('Anthropic response:', JSON.stringify(data).slice(0, 500))
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  return textBlock?.text || ''
}

export async function analyzeDefectImage(
  base64Image: string,
  mimeType: string,
  projectDescription: string,
  standards: string,
  location?: string | null,
  specText?: string | null,
  extraStandards?: ExtraStandardText[],
  feedbackExamples?: FeedbackExample[],
  finishGrade?: string | null,
  knowledgeEntries?: KnowledgeEntry[]
): Promise<{ defects: DetectedDefect[]; usage: { input_tokens: number; output_tokens: number } | null }> {

  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
  ]

  let referenceText = `Project: ${projectDescription}
Applicable standards (summary): ${standards}
${location ? `Location as recorded by the inspector: ${location}` : ''}
${finishGrade ? `Specified finish/quality grade for this location: ${finishGrade}` : ''}`

  if (specText) {
    referenceText += `\n\nExtracted project specification requirements:\n${specText}`
  }

  if (extraStandards && extraStandards.length > 0) {
    for (const std of extraStandards) {
      referenceText += `\n\nExtracted requirements from referenced standard ${std.code}:\n${std.text}`
    }
  }

  if (knowledgeEntries && knowledgeEntries.length > 0) {
    referenceText += `\n\nOrganisational defect knowledge base (known defect patterns from past inspections across all projects - treat these as authoritative, specific checks to apply where relevant to what's visible in this photo):`
    for (const k of knowledgeEntries) {
      referenceText += `\n\n- ${k.title}${k.elementType ? ` [${k.elementType}]` : ''}\n  What wrong looks like: ${k.defectDescription}${k.correctReference ? `\n  What correct looks like: ${k.correctReference}` : ''}`
    }
  }

  if (feedbackExamples && feedbackExamples.length > 0) {
    referenceText += `\n\nFeedback from this project's past inspections (use to calibrate judgement, not as rigid rules - still assess primarily on visual evidence):`
    for (const 
