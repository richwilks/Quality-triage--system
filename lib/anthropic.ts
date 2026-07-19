import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

export async function analyzeDefectImage(
  base64Image: string,
  mimeType: string,
  projectDescription: string,
  standards: string
): Promise<DetectedDefect[]> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as any, data: base64Image },
          },
          {
            type: 'text',
            text: `You are a construction quality inspector reviewing a site photo.

Project: ${projectDescription}
Applicable standards: ${standards}

Look carefully at the photo and identify EVERY distinct defect or non-conformance you can see - there may be one, several, or none. For each defect found, estimate a bounding box around just that defect, given as percentages of the image width and height (0-100), where x/y is the top-left corner.

Respond with ONLY a JSON array, no markdown formatting, no other text. Each element must have this exact shape:
{
  "description": "specific description of the defect",
  "confidence": 0.0 to 1.0,
  "standard_reference": "relevant standard or clause, or empty string if none applies",
  "box": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 }
}

If you see no defects, respond with an empty array: []`,
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find((c) => c.type === 'text')
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '[]'
  const cleaned = raw.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
