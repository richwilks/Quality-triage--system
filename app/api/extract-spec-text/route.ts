import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('spec_document_url, name')
      .eq('id', projectId)
      .single()

    if (!project?.spec_document_url) {
      return NextResponse.json({ error: 'No spec document found' }, { status: 400 })
    }

    const res = await fetch(project.spec_document_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, `${project.name} specification`)

    await supabase.from('projects').update({ spec_extracted_text: extractedText }).eq('id', projectId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
