import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage, ExtraStandard } from '@/lib/anthropic'

const MAX_EXTRA_STANDARDS = 3

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, projectId } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('description, standards, spec_document_url')
      .eq('id', projectId)
      .single()

    let specBase64: string | null = null
    if (project?.spec_document_url) {
      try {
        const specRes = await fetch(project.spec_document_url)
        const specBuffer = await specRes.arrayBuffer()
        specBase64 = Buffer.from(specBuffer).toString('base64')
      } catch {
        specBase64 = null
      }
    }

    const extraStandards: ExtraStandard[] = []
    if (project?.standards) {
      const { data: library } = await supabase
        .from('standards_library')
        .select('code, document_url')

      const matches = (library || []).filter((s) =>
        project.standards.toLowerCase().includes(s.code.toLowerCase())
      )

      for (const match of matches.slice(0, MAX_EXTRA_STANDARDS)) {
        if (!match.document_url) continue
        try {
          const res = await fetch(match.document_url)
          const buffer = await res.arrayBuffer()
          extraStandards.push({
            code: match.code,
            base64: Buffer.from(buffer).toString('base64'),
          })
        } catch {
          // skip if it fails to fetch
        }
      }
    }

    const defects = await analyzeDefectImage(
      imageBase64,
      mimeType,
      project?.description || '',
      project?.standards || '',
      specBase64,
      extraStandards
    )

    return NextResponse.json({ defects })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
