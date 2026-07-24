import { NextRequest, NextResponse } from 'next/server'
import { detectRoomLabel } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json()
    const label = await detectRoomLabel(imageBase64, mimeType || 'image/jpeg')
    return NextResponse.json({ label })
  } catch (err) {
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 })
  }
}
