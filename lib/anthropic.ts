export type BoundaryPoint = { x: number; y: number }

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
