export type BoundaryPoint = { x: number; y: number }

export async function detectRoomBoundary(
  base64Image: string,
  mimeType: string,
  clickX: number,
  clickY: number
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
              text: `This is an architectural floor plan. A point has been marked at (${clickX.toFixed(1)}%, ${clickY.toFixed(1)}%) of the image, where x=0 is the left edge and y=0 is the top edge.

Your task: trace ONLY the single room whose floor space contains this exact point, bounded strictly by its own internal walls - not neighbouring rooms, not shared corridors, not the space beyond a doorway.

Work through this carefully, step by step:
1. Locate the marked point precisely on the image.
2. Identify which four (or more) walls immediately surround that point - the nearest wall line above, below, left, and right of the point, and any additional walls if the room is an irregular shape (L-shaped, notched, etc).
3. A wall is a solid continuous line (often thicker/darker than dimension lines, grid lines, or text). Do NOT treat dimension lines, gridlines, hatching, or furniture outlines as walls.
4. A doorway opening (a gap in a wall, often with a door swing arc) is NOT part of the room boundary - trace straight across the opening as if the wall were continuous there, do not let the boundary leak through into the corridor or adjacent room.
5. If the room has a printed label (room name/number) inside it, use the visible extent of that labelled space as a strong signal for where the room's true boundary lies - the boundary should enclose that label and stop at the walls immediately around it, not extend into unlabelled neighbouring spaces.
6. Trace the boundary tightly against the actual wall lines - neither inset significantly inside the room (leaving a gap between your line and the real wall) nor extended outside it into another room or corridor.
7. Double-check before finalising: does every point in your traced boundary sit on or immediately against an actual wall line of THIS SPECIFIC room, and does the boundary exclude any neighbouring room's floor space? If any point of your boundary would fall inside a different labelled room, that room is wrong - reconsider.

Also read any printed room name or number label visible inside this specific room.

Respond with ONLY this JSON, no other text:
{
  "boundary": [{"x": 0-100, "y": 0-100}, ...] (ordered points tracing the room perimeter tightly against its actual walls, at least 4 points, more for irregular shapes),
  "label": "room name/number if readable, otherwise empty string"
}

If you cannot confidently identify a single enclosed room at that point, or the walls are too unclear/ambiguous to trace reliably, respond with: {"boundary": null, "label": ""}`,
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
