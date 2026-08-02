export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  requires_measurement: boolean
  box: { x: number; y: number; width: number; height: number }
}

export type ExtraStandardText = { code: string; text: string }
export type FeedbackExample = { description: string; wasValid: boolean; reason?: string | null }

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
  finishGrade?: string | null
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

  if (feedbackExamples && feedbackExamples.length > 0) {
    referenceText += `\n\nFeedback from this project's past inspections (use to calibrate judgement, not as rigid rules - still assess primarily on visual evidence):`
    for (const ex of feedbackExamples) {
      if (ex.wasValid) {
        referenceText += `\n- Confirmed as a real defect: "${ex.description}"`
      } else {
        referenceText += `\n- Rejected as NOT a defect: "${ex.description}"${ex.reason ? ` (reason: ${ex.reason})` : ''}`
      }
    }
  }

  const instructions = `You are a construction quality inspector reviewing a single site photo.

${referenceText}

Your task, in order:
1. Identify what element this is (floor, wall, ceiling, steel, cladding, penetration/firestopping seal, movement joint, etc) using visual evidence in the photo - camera angle, gravity cues (pooling vs streaking), junction details (skirting, coving), and surrounding context. Only use the location text above as a tiebreaker if it agrees with what you see; if it conflicts, trust the photo.
2. Finish/quality grade only applies to surface finishes where a decorative or exposure grade is meaningful - concrete floor/wall finishes, plaster, render, coatings, and similar. It does NOT apply to structural steel, grating, fixings, penetrations, MEP components, or other fabricated/installed items - never mention a missing finish grade for these, since the concept simply isn't relevant to them. Where it IS relevant: if a specified finish/quality grade is given above, calibrate strictly to that grade - many surface imperfections (minor blowholes, colour variation, light trowel marks) are entirely normal and acceptable on a lower or utility-grade finish, and only become defects against a higher exposed/decorative grade. Do not flag something as a defect just because it's visible - flag it only if it would fail the stated grade's tolerance. If a finish-relevant surface has no grade given, you may note that finish tolerance wasn't specified so the reviewer can apply judgement - but only for genuinely finish-relevant elements, never for structural/fabricated items like this grating.
3. Find every distinct defect visible in the photo - there may be one, several, or none, after applying the tolerance check above.
4. For each defect, give a tight bounding box in percentages (0-100) of image width/height, x/y being the top-left corner. Before finalising each box: mentally trace the actual boundary of the defect itself (crack line, stain edge, void perimeter), then set the box to hug just that boundary with a small margin - not the surrounding clean surface. A box covering more than roughly a third of the image width or height is almost always too loose unless the defect genuinely is that large (e.g. a long crack) - reconsider it. Never default to a box centred on the whole photo.
5. Only cite a specific standard/clause if it appears in the reference text above. If none applies, leave standard_reference empty rather than inventing or recalling a clause from memory. If you do mention a standard not present above, explicitly flag it as unverified in the description.
6. When citing a standard, always give the fullest reference available in the source text - standard number, part number, and section/clause number together, e.g. "BS 8204-1, Section 10.3" rather than just "BS 8204" or "BS 8204 Part 1" alone. Only go as deep as the source material actually specifies - never invent a section number that isn't present in the reference text.
7. CRITICAL: requires_measurement must be true ONLY when the defect is specifically about a fire-stopping seal, penetration seal, or service opening that needs to comply with a fire-rated tested detail - nothing else qualifies, ever. Structural steel gaps, grating panel spacing, floor/wall finish gaps, cracks, and general misalignment are NEVER measurement-required, even if a gap or dimension is visually mentioned in the description - set requires_measurement to false for all of these. Only for genuine fire-stopping/penetration seals: you CANNOT measure gap dimensions or annular spacing from a 2D photo - there is no reliable way to know real-world scale without a reference object in frame, and firestopping compliance against a manufacturer's tested detail is dimension-critical. NEVER state or imply a specific measurement (e.g. never say "this gap is 15mm"). Instead, if you see something that looks visually irregular for a fire seal specifically - an unusually large or uneven gap, missing intumescent material, exposed penetrant with no visible s
