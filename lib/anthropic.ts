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

  let referenceText = `Project: ${projectDescription}
Applicable standards (summary): ${standards}
${location ? `Location as recorded by the inspector: ${location}` : ''}`

  if (specText) {
    referenceText += `\n\nExtracted project specification requirements:\n${specText}`
  }

  if (extraStandards && extraStandards.length > 0) {
    for (const std of extraStandards) {
      referenceText += `\n\nExtracted requirements from referenced standard ${std.code}:\n${std.text}`
    }
  }

  const instructions = `You are a construction quality inspector reviewing a single site photo.

${referenceText}

Your task, in order:
1. Identify what element this is (floor, wall, ceiling, steel, cladding, etc) using visual evidence in the photo - camera angle, gravity cues (pooling vs streaking), junction details (skirting, coving), and surrounding context. Only use the location text above as a tiebreaker if it agrees with what you see; if it conflicts, trust the photo.
2. Find every distinct defect visible in the photo - there may be one, several, or none.
3. For each defect, give a tight bounding box in percentages (0-100) of image width/height, x/y being the top-left corner. Be precise - the box should closely frame just that defect, not the whole photo or a large surrounding area.
4. Only cite a specific standard/clause if it appears in the reference text above. If none applies, leave standard_reference empty rather than inventing or recalling a clause from memory. If you do mention a standard not present above, explicitly flag it as unverified in the description.

Respond with ONLY a JSON array, no markdown, no other text:
[
  {
    "description": "specific description of the defect",
    "confidence": 0.0 to 1.0,
    "standard_reference": "clause/standard from the reference text only, or empty string",
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

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
