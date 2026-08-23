import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkForDuplicate } from '@/lib/anthropic'

export const maxDuration = 20

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId } = await req.json()

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('defects')
      .select('id, description, ai_description, location')
      .eq('project_id', projectId)
      .in('status', ['draft', 'confirmed', 'assigned', 'pending_approval'])
      .limit(30)

    const existingDefects = (existing || []).map((d: any) => ({
      id: d.id,
      description: d.description || d.ai_description || 'unknown',
      location: d.location,
    }))

    const result = await checkForDuplicate(imageBase64, mimeType, existingDefects)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ isDuplicate: false, matchedId: null, reason: '' })
  }
}

