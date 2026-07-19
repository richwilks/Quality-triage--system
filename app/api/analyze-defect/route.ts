import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId } = await req.json()

    const supabase = createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, standards')
      .eq('id', projectId)
      .single()

    const defects = await analyzeDefectImage(
      imageBase64,
      mimeType,
      project?.description || '',
      project?.standards || ''
    )

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
