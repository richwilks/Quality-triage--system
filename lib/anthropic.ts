export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

export type ExtraStandard = { code: string; base64: string }

export async function analyzeDefectImage(
  base64Image: string,
  mimeType: string,
  projectDescription: string,
  standards: string,
  specBase64?: string | null,
  extraStandards?: ExtraStandard[]
): Promise<DetectedDefect[]> {
  const content: any[] = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64Image },
    },
  ]

  if (specBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: specBase64 },
    })
  }

  if (extraStandards && extraStandards.length > 0) {
    for (const std of extraStandards) {
      content.push({
        type: 'text',
        text: `The following document is the full text of referenced standard ${std.code}:`,
      })
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: std.base64 },
      })
    }
  }

  content.push({
    type: 'text',
    text: `You are a construction quality inspector reviewing a site photo.

Project: ${projectDescription}
Applicable standards (summary): ${standards}
${specBase64 ? 'A full project specification document is attached above - check the photo against its actual requirements.' : ''}
${extraStandards && extraStandards.length > 0 ? `Full text of the following referenced standards is also attached: ${extraStandards.map((s) => s.code).join(', ')}. Use their actual clauses where relevant.` : ''}

Look carefully at the photo and identify EVERY distinct defect or non-conformance you can see - there may be one, several, or none. For each defect found, estimate a bounding box around just that defect, given as percentages of the image width and height (0-100), where x/y is the top-left corner.

Respond with ONLY a JSON array, no markdown formatting, no other text. Each element must have this exact shape:
{
  "description": "specific description of the defect",
  "confidence": 0.0 to 1.0,
  "standard_reference": "relevant clause number and standard, or empty string if none applies",
  "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
}

If you see no defects, respond with an empty array: []`,
  })

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
