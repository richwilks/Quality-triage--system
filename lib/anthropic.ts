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
7. CRITICAL: requires_measurement must be true ONLY when the defect is specifically about a fire-stopping seal, penetration seal, or service opening that needs to comply with a fire-rated tested detail - nothing else qualifies, ever. Structural steel gaps, grating panel spacing, floor/wall finish gaps, cracks, and general misalignment are NEVER measurement-required, even if a gap or dimension is visually mentioned in the description - set requires_measurement to false for all of these. Only for genuine fire-stopping/penetration seals: you CANNOT measure gap dimensions or annular spacing from a 2D photo - there is no reliable way to know real-world scale without a reference object in frame, and firestopping compliance against a manufacturer's tested detail is dimension-critical. NEVER state or imply a specific measurement (e.g. never say "this gap is 15mm"). Instead, if you see something that looks visually irregular for a fire seal specifically - an unusually large or uneven gap, missing intumescent material, exposed penetrant with no visible sealant, absence of a visible product/certification label - flag it as requires_measurement true, and describe only what you can see, explicitly stating a manual measurement against the relevant tested detail is needed. Before setting requires_measurement to true, ask yourself: is this specifically a fire-stopping or service penetration seal? If not, it must be false.
8. Reference spec text describes expected materials for this project but does not guarantee every element in every photo is that material - confirm the material you see in the photo before applying spec requirements for a different material to it. If the photo shows metal, steel, aluminium, or grating, do not treat it as concrete even if a concrete spec is loaded.
9. Movement joints and expansion joint cover plates: if the reference text above includes a figure description of correct installation for a movement joint product (e.g. an Inpro-style anchor plate with a floating top cover plate), compare the photo carefully against that described correct configuration - check whether components are positioned, covered, or concealed exactly as the figure describes, not just whether a joint is generally present. A movement joint that is physically installed but incorrectly positioned (e.g. installed at maximum expansion with no remaining movement allowance, indicated by fixing/anchor screw holes being visible rather than concealed by the top cover plate as the correct-installation figure describes) is a real, high-priority defect - correct presence of a joint is not sufficient, correct positioning per the reference figure is required. If no matching product figure is available in the reference text, still visually check for obvious movement joint installation issues (missing cover plate, cover plate not seated, visible fixings where none should show) using general good-practice judgement, and note in the description that this is based on general visual judgement rather than a specific manufacturer detail.
10. If the organisational defect knowledge base above lists any entries, actively check the photo against each one that's relevant to the element identified in step 1 - these are known, previously-confirmed defect patterns from real inspections and should be checked as specifically and rigorously as the numbered rules above, not treated as general background context.

Respond with ONLY a JSON array, no markdown, no other text:

[
  {
    "description": "specific description of the defect",
    "confidence": 0.0 to 1.0,
    "standard_reference": "full reference including standard, part, and section/clause where available - e.g. 'BS 8204-1, Section 10.3' - or empty string if none applies",
    "requires_measurement": true or false,
    "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
  }
]

If no defects, respond with: []`

  content.push({ type: 'text', text: instructions })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content }],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const raw = textBlock?.text || '[]'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  const usage = data.usage
    ? { input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 }
    : null

  function clampBox(box: any) {
    const x = Math.max(0, Math.min(100, box?.x ?? 0))
    const y = Math.max(0, Math.min(100, box?.y ?? 0))
    const width = Math.max(1, Math.min(100 - x, box?.width ?? 10))
    const height = Math.max(1, Math.min(100 - y, box?.height ?? 10))
    return { x, y, width, height }
  }

  try {
    const parsed = JSON.parse(cleaned)
    const defects = Array.isArray(parsed)
      ? parsed.map((d: any) => ({ ...d, requires_measurement: !!d.requires_measurement, box: clampBox(d.box) }))
      : []
    return { defects, usage }
  } catch {
    return { defects: [], usage }
  }
}

export async function detectRoomLabel(base64Image: string, mimeType: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            {
              type: 'text',
              text: `This is a small cropped section of a construction drawing. If there is a room name, room number, or space label printed as text in this crop, respond with ONLY that exact text, nothing else. If there is no readable label in this crop, respond with exactly: NONE`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const result = (textBlock?.text || '').trim()
  return result === 'NONE' ? '' : result
}

export type ExistingDefectSummary = { id: string; description: string; location: string | null }

export async function checkForDuplicate(
  base64Image: string,
  mimeType: string,
  existingDefects: ExistingDefectSummary[]
): Promise<{ isDuplicate: boolean; matchedId: string | null; reason: string }> {
  if (existingDefects.length === 0) {
    return { isDuplicate: false, matchedId: null, reason: '' }
  }

  const listText = existingDefects
    .map((d, i) => `${i + 1}. [id: ${d.id}] ${d.location ? `(${d.location}) ` : ''}${d.description}`)
    .join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            {
              type: 'text',
              text: `Here is a list of defects already open on this project:\n${listText}\n\nLooking at the photo, does it appear to show the SAME physical defect as one already in this list (same location, same specific issue - not just a similar type of defect elsewhere)? Be conservative - only flag a match if you're reasonably confident it's the same physical spot and issue, not just a similar-looking defect. Respond with ONLY this JSON, no other text: {"isDuplicate": true or false, "matchedId": "the id from the list, or null", "reason": "brief explanation"}`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const raw = textBlock?.text || '{}'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      isDuplicate: !!parsed.isDuplicate,
      matchedId: parsed.matchedId || null,
      reason: parsed.reason || '',
    }
  } catch {
    return { isDuplicate: false, matchedId: null, reason: '' }
  }
}

export async function detectRoomBoundary(
  base64Image: string,
  mimeType: string,
  markerX: number,
  markerY: number
): Promise<{ boundary: BoundaryPoint[] | null; label: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            {
              type: 'text',
              text: `This is a CROPPED, ZOOMED-IN section of an architectural floor plan. A red circle marker has been drawn directly onto this image at approximately (${markerX.toFixed(1)}%, ${markerY.toFixed(1)}%) of this cropped image's width/height - you can see the red dot itself, use its visible position as ground truth over the numeric estimate.

Your task: trace ONLY the single room whose floor space contains that red marker, bounded strictly by its own surrounding walls - not neighbouring rooms, not corridors, not spaces beyond a doorway.

Work through this step by step:
1. Find the red marker dot on the image.
2. Identify the walls immediately enclosing it - the nearest solid wall line on every side. A wall is a continuous solid line, thicker/darker than dimension lines, gridlines, or furniture outlines - do not confuse those with walls.
3. A doorway opening (gap in a wall, often with a door swing arc) is NOT part of the boundary - trace straight across it as if the wall continued, never let the boundary extend through into an adjacent space.
4. If a room label/number is printed inside this room, its visible extent confirms where the boundary should sit - enclose the label, stop at the walls around it.
5. If the room's true edge is cut off by the edge of this cropped image, extend your boundary point to that image edge rather than guessing further.
6. Trace tightly against the real wall lines - not inset with a gap, not extended past them into another space.
7. Before finalising, check every boundary point sits on or against a real wall of THIS room only, and that no point falls inside a visibly different labelled room.

Also read any printed room name or number label visible inside this room.

Respond with ONLY this JSON, no other text:
{
  "boundary": [{"x": 0-100, "y": 0-100}, ...] (points as percentages of THIS CROPPED image, tracing the room perimeter tightly, at least 4 points),
  "label": "room name/number if readable, otherwise empty string"
}

If you cannot confidently trace a single enclosed room around the marker, respond with: {"boundary": null, "label": ""}`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const raw = textBlock?.text || '{}'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      boundary: Array.isArray(parsed.boundary) ? parsed.boundary : null,
      label: parsed.label || '',
    }
  } catch {
    return { boundary: null, label: '' }
  }
}
