import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractDocumentText } from '@/lib/anthropic'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { buildingId } = await req.json()

    const supabase = await createClient()
    const { data: building } = await supabase
      .from('copsefield_buildings')
      .select('strata_report_url, name')
      .eq('id', buildingId)
      .single()

    if (!building?.strata_report_url) {
      return NextResponse.json({ error: 'No strata report on file' }, { status: 400 })
    }

    const res = await fetch(building.strata_report_url)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const extractedText = await extractDocumentText(base64, `${building.name} strata report`)

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    await supabaseAdmin.from('copsefield_buildings').update({ strata_report_text: extractedText }).eq('id', buildingId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
