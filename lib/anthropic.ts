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
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image },
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