export async function analyzeDefectImage(
  imageBase64: string,
  mimeType: string,
  projectSpec: string
) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are assisting a construction quality manager reviewing a site photo. Compare what you see against the project specification and standards below, and identify any potential defect or non-conformance.

Project specification / standards:
${projectSpec}

Respond with ONLY valid JSON, no other text, in this exact structure:
{"defect_found": true or false, "description": "plain description of the issue, or why nothing looks wrong", "confidence": a number between 0 and 1, "standard_reference": "which standard/spec clause this relates to, or empty string if none"}`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  const text =
        data.content?.map((block: { text?: string }) => block.text || '').join('') || ''
  const cleaned = text.replace(/```json|```/g, '').trim()

  return JSON.parse(cleaned)
}
