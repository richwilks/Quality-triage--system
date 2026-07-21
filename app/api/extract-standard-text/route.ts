import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { standardId } = await req.json()

    const supabase = await createClient()
    const { data: standard } = await supabase
      .from('standards_library')
      .select('document_url, code')
      .eq('id', standardId)
      .single()

    if (!standard?.document_url) {
      return NextResponse.json({ error: 'No document found' }, { status: 400 })
    }

    const res = await fetch(standard.document_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, standard.code)

    await supabase.from('standards_library').update({ extracted_text: extractedText }).eq('id', standardId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
