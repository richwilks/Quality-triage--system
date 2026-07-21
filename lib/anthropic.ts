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
  specText?: string | null,
  extraStandards?: ExtraStandardText[]
): Promise<DetectedDefect[]> {
  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
  ]

  let contextText = `You are a construction quality inspector reviewing a site photo.

Project: ${projectDescription}
Applicable standards (summary): ${standards}
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
Look carefully at the photo and identify EVERY distinct defect or non-conformance you can see - there may be one, several, or none. For each defect found, estimate a bounding box around just that defect, given as percentages of the image width and height (0-100), where x/y is the top-left corner.

Respond with ONLY a JSON array, no markdown formatting, no other text. Each element must have this exact shape:
{
  "description": "specific description of the defect",
  "confidence": 0.0 to 1.0,
  "standard_reference": "relevant clause number and standard, or empty string if none applies",
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
