import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { regulationId } = await req.json()

    const supabase = await createClient()
    const { data: regulation } = await supabase
      .from('fmiq_regulations_library')
      .select('document_url, code')
      .eq('id', regulationId)
      .single()

    if (!regulation?.document_url) {
      return NextResponse.json({ error: 'No document found' }, { status: 400 })
    }

    const res = await fetch(regulation.document_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, regulation.code)

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    await supabaseAdmin
      .from('fmiq_regulations_library')
      .update({ extracted_text: extractedText })
      .eq('id', regulationId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
