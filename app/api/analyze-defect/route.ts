import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, ExtraStandardText } from '@/lib/anthropic'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId, location } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, standards, spec_extracted_text')
      .eq('id', projectId)
      .single()

    const extraStandards: ExtraStandardText[] = []
    if (project?.standards) {
      const { data: library } = await supabase
        .from('standards_library')
        .select('code, extracted_text')

      const matches = (library || []).filter(
        (s) => s.extracted_text && project.standards.toLowerCase().includes(s.code.toLowerCase())
      )

      matches.forEach((m) => extraStandards.push({ code: m.code, text: m.extracted_text }))
    }

    const defects = await analyzeDefectImage(
      imageBase64,
      mimeType,
      project?.description || '',
      project?.standards || '',
      location || null,
      project?.spec_extracted_text || null,
      extraStandards
    )

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
