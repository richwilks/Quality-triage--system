import { NextRequest, NextResponse } from 'next/server'
import { detectRoomBoundary } from '@/lib/anthropic'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, clickX, clickY } = await req.json()

    if (!imageBase64 || clickX === undefined || clickY === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await detectRoomBoundary(imageBase64, mimeType || 'image/jpeg', clickX, clickY)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 })
  }
}
