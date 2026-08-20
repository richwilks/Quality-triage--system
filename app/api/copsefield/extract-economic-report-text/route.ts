import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractDocumentText, summarizeEconomicReportText } from '@/lib/anthropic'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { reportId } = await req.json()

    const supabase = await createClient()
    const { data: report } = await supabase
      .from('copsefield_economic_reports')
      .select('document_url, title, category')
      .eq('id', reportId)
      .single()

    if (!report?.document_url) {
      return NextResponse.json({ error: 'No document found' }, { status: 400 })
    }

    const res = await fetch(report.document_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, report.title)
    const summary = extractedText ? await summarizeEconomicReportText(extractedText, report.title, report.category) : ''

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    await supabaseAdmin
      .from('copsefield_economic_reports')
      .update({ extracted_text: extractedText, summary: summary || null })
      .eq('id', reportId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
