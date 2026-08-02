import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { specId } = await req.json()

    const supabase = await createClient()
    const { data: spec } = await supabase
      .from('project_specs')
      .select('document_url, name')
      .eq('id', specId)
      .single()

    if (!spec?.document_url) {
      return NextResponse.json({ error: 'No spec document found' }, { status: 400 })
    }

    const res = await fetch(spec.document_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, spec.name || 'project specification')

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('project_specs')
      .update({ extracted_text: extractedText })
      .eq('id', specId)
      .select()

    console.log('Update result:', JSON.stringify({ updateData, updateError }))

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
