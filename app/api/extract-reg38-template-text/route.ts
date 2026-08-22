import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { companyName, templateUrl, templateName }: { companyName: string; templateUrl: string; templateName: string } =
      await req.json()

    if (!companyName || !templateUrl) {
      return NextResponse.json({ error: 'Missing company or template document' }, { status: 400 })
    }

    const res = await fetch(templateUrl)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, templateName || 'Regulation 38 report template')

    // update_company_reg38_template is SECURITY DEFINER and does its own
    // company_admin/platform_admin check against auth.uid() internally, so
    // this must go through the caller's own authenticated session (not the
    // service-role client, which carries no user identity for that check).
    const supabase = await createClient()

    const { error: rpcError } = await supabase.rpc('update_company_reg38_template', {
      target_company: companyName,
      template_name: templateName,
      template_url: templateUrl,
      extracted_text: extractedText,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
