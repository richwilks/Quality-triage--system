export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  requires_measurement: boolean
  element_type: string
  box: { x: number; y: number; width: number; height: number }
}

export type OrientationHint = { betaDeg: number; guess: 'floor' | 'wall' | 'ceiling' | 'uncertain' }

export type ExtraStandardText = { code: string; text: string }
export type FeedbackExample = { description: string; wasValid: boolean; reason?: string | null }
export type KnowledgeEntry = {
  title: string
  elementType: string | null
  defectDescription: string
  correctReference: string | null
  photoBase64?: string | null
  photoMimeType?: string | null
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
  knowledgeEntries?: KnowledgeEntry[],
  orientationHint?: OrientationHint | null
): Promise<{ defects: DetectedDefect[]; usage: { input_tokens: number; output_tokens: number } | null }> {

  const content: any[] = [
    { type: 'text', text: 'Photo under review:' },
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
  ]

  const orientationText =
    orientationHint && orientationHint.guess !== 'uncertain'
      ? `Device orientation sensor at the moment of capture: the phone/tablet's tilt suggests this photo is most likely of a ${
          orientationHint.guess === 'floor'
            ? 'floor (camera pointed downward)'
            : orientationHint.guess === 'ceiling'
              ? 'ceiling (camera pointed upward)'
              : 'wall or other roughly vertical surface (camera held level)'
        }. This is a physical sensor reading, not a content guess - treat it as a supporting signal for step 1 below, but the photo's own visual evidence is still primary if it ever conflicts with this reading.`
      : ''

  let referenceText = `Project: ${projectDescription}
Applicable standards (summary): ${standards}
${location ? `Location as recorded by the inspector: ${location}` : ''}
${finishGrade ? `Specified finish/quality grade for this location: ${finishGrade}` : ''}
${orientationText}`

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
      referenceText += `\n\n- ${k.title}${k.elementType ? ` [${k.elementType}]` : ''}\n  What wrong looks like: ${k.defectDescription}${k.correctReference ? `\n  What correct looks like: ${k.correctReference}` : ''}${k.photoBase64 ? '\n  A reference photo for this entry follows below, with the exact defect area outlined in red - use it to visually calibrate what this pattern actually looks like, not just the text description.' : ''}`
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
1. Identify what element this is using visual evidence in the photo - camera angle, gravity cues (pooling vs streaking), junction details (skirting, coving), and surrounding context. Classify it into exactly one of: "floor", "wall", "ceiling", "structural_steel", "cladding_envelope", "fire_penetration", "movement_joint", "mep", "other" - this becomes the element_type field below. Only use the location text or device orientation sensor reading above as a tiebreaker if either agrees with what you see; if either conflicts with the photo, trust the photo.
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
    "element_type": "one of: floor, wall, ceiling, structural_steel, cladding_envelope, fire_penetration, movement_joint, mep, other - from step 1",
    "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
  }
]

If no defects, respond with: []`

  content.push({ type: 'text', text: instructions })

  const entriesWithPhotos = (knowledgeEntries || []).filter((k) => k.photoBase64 && k.photoMimeType)
  for (const k of entriesWithPhotos) {
    content.push({
      type: 'text',
      text: `Reference photo for knowledge base entry "${k.title}" - the exact defect area is outlined in red:`,
    })
    content.push({ type: 'image', source: { type: 'base64', media_type: k.photoMimeType, data: k.photoBase64 } })
  }
  if (entriesWithPhotos.length > 0) {
    content.push({
      type: 'text',
      text: 'That was the last reference photo. Now analyse the photo under review (the first image above) and respond with ONLY the JSON array described above - nothing else.',
    })
  }

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
      ? parsed.map((d: any) => ({
          ...d,
          requires_measurement: !!d.requires_measurement,
          element_type: typeof d.element_type === 'string' ? d.element_type : 'other',
          box: clampBox(d.box),
        }))
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

// --- FMIQ property inspections ---

export type InspectionFinding = {
  description: string
  confidence: number
  regulation_reference: string
  severity: 'minor' | 'moderate' | 'major' | 'hazard'
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  box: { x: number; y: number; width: number; height: number }
}

export type RegulationText = { code: string; text: string }

export async function analyzePropertyInspection(
  base64Image: string,
  mimeType: string,
  propertyDescription: string,
  jurisdiction: string | null,
  propertyType: string | null,
  regulationTexts: RegulationText[],
  orientationHint?: OrientationHint | null
): Promise<{ findings: InspectionFinding[]; usage: { input_tokens: number; output_tokens: number } | null }> {
  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
  ]

  const orientationText =
    orientationHint && orientationHint.guess !== 'uncertain'
      ? `Device orientation sensor at the moment of capture: the phone/tablet's tilt suggests this photo is most likely of a ${
          orientationHint.guess === 'floor'
            ? 'floor (camera pointed downward)'
            : orientationHint.guess === 'ceiling'
              ? 'ceiling (camera pointed upward)'
              : 'wall or other roughly vertical surface (camera held level)'
        }. Treat this as a supporting signal only - the photo's own visual evidence is primary.`
      : ''

  let referenceText = `Property: ${propertyDescription}
${jurisdiction ? `Jurisdiction / applicable regulations: ${jurisdiction}` : 'Jurisdiction not specified - use general good-practice property condition standards.'}
${propertyType ? `Property type: ${propertyType}` : ''}
${orientationText}`

  if (regulationTexts.length > 0) {
    for (const reg of regulationTexts) {
      referenceText += `\n\nExtracted requirements from regulation/standard ${reg.code}:\n${reg.text}`
    }
  }

  const instructions = `You are a property inspector assessing a single photo taken during a property inspection, checking for regulatory compliance and condition issues.

${referenceText}

Your task, in order:
1. Find every distinct condition or compliance issue visible in the photo - disrepair, damage, safety hazards, signs of damp/mould, missing or non-compliant fittings, anything that would fail a property condition or regulatory compliance check. There may be one, several, or none.
2. For each issue, give a tight bounding box in percentages (0-100) of image width/height, x/y being the top-left corner, hugging just the defect itself with a small margin.
3. Only cite a specific regulation/clause if it appears in the reference text above. If none applies, leave regulation_reference empty rather than inventing one. If you mention a regulation not present above, explicitly flag it as unverified in the description.
4. Classify severity as one of: "minor" (cosmetic, no urgency), "moderate" (should be addressed but not urgent), "major" (significant defect, address soon), "hazard" (immediate health/safety risk - e.g. exposed wiring, active leak, structural concern, fire safety breach).
5. Give a rough estimated repair cost range (estimated_cost_min, estimated_cost_max) in the absence of a real quote - base it on general knowledge of typical repair costs for this kind of issue. This is a ballpark indication only, not a quote - if you have no reasonable basis to estimate, set both to null rather than guessing wildly.

Respond with ONLY a JSON array, no markdown, no other text:

[
  {
    "description": "specific description of the issue",
    "confidence": 0.0 to 1.0,
    "regulation_reference": "full reference where available, or empty string if none applies",
    "severity": "minor" | "moderate" | "major" | "hazard",
    "estimated_cost_min": number or null,
    "estimated_cost_max": number or null,
    "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
  }
]

If no issues, respond with: []`

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
    const findings = Array.isArray(parsed)
      ? parsed.map((f: any) => ({
          ...f,
          severity: ['minor', 'moderate', 'major', 'hazard'].includes(f.severity) ? f.severity : 'moderate',
          estimated_cost_min: typeof f.estimated_cost_min === 'number' ? f.estimated_cost_min : null,
          estimated_cost_max: typeof f.estimated_cost_max === 'number' ? f.estimated_cost_max : null,
          box: clampBox(f.box),
        }))
      : []
    return { findings, usage }
  } catch {
    return { findings: [], usage }
  }
}

export type FindingSummary = {
  description: string
  severity: string
  regulation_reference: string | null
  estimated_cost_min: number | null
  estimated_cost_max: number | null
}

export async function generateComplianceReport(
  propertyName: string,
  propertyAddress: string | null,
  inspectionDate: string,
  findings: FindingSummary[]
): Promise<string> {
  const findingsText = findings.length
    ? findings
        .map(
          (f, i) =>
            `${i + 1}. [${f.severity.toUpperCase()}] ${f.description}${f.regulation_reference ? ` (Ref: ${f.regulation_reference})` : ''}${
              f.estimated_cost_min !== null ? ` - Est. repair cost: ${f.estimated_cost_min}-${f.estimated_cost_max}` : ''
            }`
        )
        .join('\n')
    : 'No issues were found during this inspection.'

  const prompt = `You are writing a formal property inspection compliance report for a client.

Property: ${propertyName}${propertyAddress ? ` (${propertyAddress})` : ''}
Inspection date: ${inspectionDate}

Findings from this inspection:
${findingsText}

Write a clear, professional compliance report in plain text (markdown headings ok, no other formatting). Structure it as:
1. Executive summary (2-3 sentences: overall condition, number of findings by severity, any hazards requiring immediate attention)
2. Findings in detail, grouped by severity (hazard first, then major, moderate, minor)
3. Total estimated repair cost range, summed across all findings that have an estimate, clearly caveated that these are rough AI-generated ballpark estimates, not quotes, and a qualified contractor should be engaged for accurate pricing before any work is commissioned
4. Recommended next steps, prioritised by severity

Be factual and measured - do not exaggerate or downplay findings. If there are no findings, say so plainly and note the property appeared to be in good order at the time of inspection.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  return textBlock?.text || 'Could not generate report.'
}

export type EconomicReportExcerpt = { title: string; category: string | null; text: string }

export async function generateInvestmentReport(
  propertyName: string,
  propertyAddress: string | null,
  propertyType: string | null,
  findings: FindingSummary[],
  pastInspectionSummaries: string[],
  economicReports: EconomicReportExcerpt[]
): Promise<string> {
  const findingsText = findings.length
    ? findings
        .map((f) => `- [${f.severity}] ${f.description}${f.estimated_cost_min !== null ? ` (est. ${f.estimated_cost_min}-${f.estimated_cost_max})` : ''}`)
        .join('\n')
    : 'No outstanding findings on record.'

  let economicText = ''
  if (economicReports.length > 0) {
    economicText = economicReports
      .map((r) => `--- ${r.title}${r.category ? ` (${r.category})` : ''} ---\n${r.text}`)
      .join('\n\n')
  }

  const prompt = `You are a property investment analyst producing an investment/return report for a property owner, estimating the potential return on investing in maintenance and improvements.

Property: ${propertyName}${propertyAddress ? ` (${propertyAddress})` : ''}${propertyType ? `, type: ${propertyType}` : ''}

Current outstanding condition findings for this property:
${findingsText}

${pastInspectionSummaries.length > 0 ? `Summary of past inspections on this property:\n${pastInspectionSummaries.join('\n')}\n` : ''}

${economicText ? `Reference market/economic data (rental, commercial property, and construction industry reports):\n${economicText}` : 'No market/economic reference reports have been uploaded yet - base guidance on general industry knowledge and say so explicitly.'}

Write a clear, professional investment return report in plain text (markdown headings ok). Structure it as:
1. Executive summary
2. Condition-driven risk: what happens to value/rentability if outstanding findings are left unaddressed
3. Estimated return on investment if repairs/improvements are carried out - reference the market/economic data above where it's genuinely relevant, and be explicit when a figure is a rough estimate rather than sourced from the provided data
4. Lease/rental potential: how addressing these findings (and any broader improvement opportunities you can reasonably infer for this property type) could affect achievable rent or lease terms
5. Recommended priority order of investment, balancing cost against expected return

Be honest about uncertainty - do not present speculative figures as precise or guaranteed. If the reference data doesn't cover this property's type/region, say so rather than inventing numbers that look authoritative.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  return textBlock?.text || 'Could not generate report.'
}


// --- FMIQ guided checklist inspections ---

export type ChecklistItem = {
  category: string
  item_text: string
  mandatory: boolean
  source: 'regulation' | 'general_practice'
}

// Drafts a checklist template for a jurisdiction + property type - a human
// reviews/edits it afterward (fmiq_checklist_templates.source stays 'ai'
// until someone edits it). Items grounded in uploaded regulation text are
// marked mandatory/regulation; anything else is marked general_practice so
// reviewers know what to double-check against the real local requirements.
export async function generateChecklistTemplate(
  jurisdiction: string,
  propertyType: string,
  regulationTexts: RegulationText[]
): Promise<{ items: ChecklistItem[]; usage: { input_tokens: number; output_tokens: number } | null }> {
  let referenceText = `Jurisdiction: ${jurisdiction}\nProperty type: ${propertyType}`

  if (regulationTexts.length > 0) {
    for (const reg of regulationTexts) {
      referenceText += `\n\nExtracted requirements from regulation/standard ${reg.code}:\n${reg.text}`
    }
  } else {
    referenceText += `\n\nNo regulation documents have been uploaded for this jurisdiction yet - base items on general, widely-applicable property inspection good practice, and mark every item "general_practice" rather than inventing specific regulatory citations.`
  }

  const prompt = `You are drafting a property inspection checklist template that a human will review and correct before it's used in the field.

${referenceText}

Produce a checklist of discrete, checkable items a property inspector should walk through on-site for this jurisdiction and property type. Group items under short category headings (e.g. "Fire Safety", "Structural", "Electrical", "Plumbing", "Accessibility", "Exterior/Envelope", "Common Areas" - use whatever categories fit what's actually being checked).

For each item:
- item_text: one specific, checkable thing to inspect (e.g. "Smoke alarms present and tested in every bedroom and hallway", not vague like "check fire safety").
- mandatory: true only if this is a genuine mandatory legal/regulatory requirement you can support from the reference text above; false for a good-practice item that isn't itself a hard legal requirement.
- source: "regulation" only if grounded in the extracted requirement text above (mandatory must be true in this case); otherwise "general_practice".

Be thorough but not padded - real, distinct, checkable items only, not duplicates or vague restatements of the same point. This is a first draft for a human reviewer, so it is fine and expected to be imperfect - do not fabricate specific clause numbers or regulation names that aren't in the reference text above.

Respond with ONLY a JSON array, no markdown, no other text:

[
  { "category": "string", "item_text": "string", "mandatory": true or false, "source": "regulation" | "general_practice" }
]`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const raw = textBlock?.text || '[]'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  const usage = data.usage
    ? { input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 }
    : null

  try {
    const parsed = JSON.parse(cleaned)
    const items: ChecklistItem[] = Array.isArray(parsed)
      ? parsed.map((i: any): ChecklistItem => ({
          category: i.category || 'General',
          item_text: i.item_text || '',
          mandatory: !!i.mandatory && i.source === 'regulation' ? true : !!i.mandatory,
          source: i.source === 'regulation' ? 'regulation' : 'general_practice',
        })).filter((i: ChecklistItem) => i.item_text.trim().length > 0)
      : []
    return { items, usage }
  } catch {
    return { items: [], usage }
  }
}

// Assesses a single photo attached to one checklist item - narrower than
// analyzePropertyInspection: no bounding box, since the whole photo is the
// evidence for this one specific item rather than a general room scan.
export async function analyzeChecklistItemPhoto(
  base64Image: string,
  mimeType: string,
  itemText: string,
  jurisdiction: string | null
): Promise<{
  analysis: string
  severity: 'minor' | 'moderate' | 'major' | 'hazard' | null
  usage: { input_tokens: number; output_tokens: number } | null
}> {
  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
    {
      type: 'text',
      text: `You are a property inspector. This photo was taken as evidence for the following checklist item${jurisdiction ? ` (jurisdiction: ${jurisdiction})` : ''}:

"${itemText}"

Assess whether the photo shows this item passing or failing, and describe specifically what you can see that supports your assessment. If the photo doesn't clearly show enough to judge the item, say so plainly rather than guessing.

If there is a genuine issue, classify severity as one of: "minor" (cosmetic, no urgency), "moderate" (should be addressed but not urgent), "major" (significant defect, address soon), "hazard" (immediate health/safety risk). If there's no issue, or the photo is inconclusive, set severity to null.

Respond with ONLY this JSON object, no markdown, no other text:
{ "analysis": "string", "severity": "minor" | "moderate" | "major" | "hazard" | null }`,
    },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      messages: [{ role: 'user', content }],
    }),
  })

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  const raw = textBlock?.text || '{}'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  const usage = data.usage
    ? { input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 }
    : null

  try {
    const parsed = JSON.parse(cleaned)
    const severity = ['minor', 'moderate', 'major', 'hazard'].includes(parsed.severity) ? parsed.severity : null
    return { analysis: parsed.analysis || '', severity, usage }
  } catch {
    return { analysis: '', severity: null, usage }
  }
}
