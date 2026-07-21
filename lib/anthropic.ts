export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

export type ExtraStandardText = { code: string; text: string }

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
              text: `This document is "${label}". Extract and summarise, in plain text, every testable requirement, tolerance, clause number, material spec, and defect criterion a site inspector would need to check work against. Be thorough but concise - this will be reused for every future inspection, so don't omit anything that could matter, but don't pad with commentary. Output plain text only, organised by clause/section where possible.`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
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
  extraStandards?: ExtraStandardText[]
): Promise<DetectedDefect[]> {
  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
  ]

  let contextText = `You are a construction quality inspector reviewing a site photo.

Project: ${projectDescription}
Applicable standards (summary): ${standards}
${location ? `Location as recorded by the inspector: ${location}` : ''}
`

  if (specText) {
    contextText += `\nExtracted project specification requirements:\n${specText}\n`
  }

  if (extraStandards && extraStandards.length > 0) {
    for (const std of extraStandards) {
      contextText += `\nExtracted requirements from referenced standard ${std.code}:\n${std.text}\n`
    }
  }

  contextText += `
IMPORTANT - before assessing defects, you must first determine what building element this actually is: floor, wall, ceiling, structural steel, external cladding, etc. Do this by reading the physical evidence in the photo itself:
- Camera angle and perspective (are you looking down at a horizontal surface, or across at a vertical one?)
- Gravity cues (pooling, dripping, or settling patterns only make sense on horizontal surfaces; running or streaking patterns suggest vertical ones)
- Junction details (skirting boards, floor-wall junctions, ceiling coving, corner details)
- Surrounding context visible in frame (visible floor plane, visible ceiling, adjacent walls)

Treat this as a required first step every time, independent of any location text supplied - the photo itself is the primary evidence. If location text is provided and it agrees with the visual evidence, use it to add detail (e.g. which wall, which room). If it's missing, absent, or seems to conflict with what the photo shows, rely on the visual evidence alone and describe what you actually see rather than guessing from habit or assumption.

IMPORTANT - only cite a specific standard, clause, or number if it appears in the extracted specification or standards text provided above. If no attached document covers the relevant point, either leave standard_reference empty or describe the general requirement without inventing a specific clause number. If you do reference a standard from general knowledge rather than an attached document, explicitly say so in the description (e.g. "note: verify this standard is still current, as it is not from an attached document") rather than stating it as settled fact - standards are periodically revised or withdrawn and your training knowledge may be out of date.

Look carefully at the photo and identify EVERY distinct defect or non-conformance you can see - there may be one, several, or none. For each defect found, estimate a bounding box around just that defect, given as percentages of the image width and height (0-100), where x/y is the top-left corner.

Respond with ONLY a JSON array, no markdown formatting, no other text. Each element must have this exact shape:
{
  "description": "specific description of the defect",
  "confidence": 0.0 to 1.0,
  "standard_reference": "relevant clause number and standard from attached documents only, or empty string if none applies",
  "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
}

If you see no defects, respond with an empty array: []`

  content.push({ type: 'text', text: contextText })

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

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
