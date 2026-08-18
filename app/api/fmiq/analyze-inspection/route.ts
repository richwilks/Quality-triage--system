import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzePropertyInspection, RegulationText, OrientationHint } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const {
      imageBase64,
      mimeType,
      assetId,
      orientationHint,
    }: {
      imageBase64: string
      mimeType: string
      assetId: string
      orientationHint?: OrientationHint | null
    } = await req.json()

    const supabase = await createClient()
    const { data: asset } = await supabase
      .from('fmiq_assets')
      .select('name, location, notes, property_type, jurisdiction, company_name')
      .eq('id', assetId)
      .single()

    const regulationTexts: RegulationText[] = []
    if (asset?.jurisdiction) {
      const { data: regulations } = await supabase
        .from('fmiq_regulations_library')
        .select('code, extracted_text, jurisdiction')
        .not('extracted_text', 'is', null)

      const jurisdictionNormalized = asset.jurisdiction.toLowerCase().trim()
      ;(regulations || [])
        .filter((r) => !r.jurisdiction || r.jurisdiction.toLowerCase().trim() === jurisdictionNormalized)
        .forEach((r) => regulationTexts.push({ code: r.code, text: r.extracted_text }))
    }

    const propertyDescription = [asset?.name, asset?.location, asset?.notes].filter(Boolean).join(' - ')

    const { findings, usage } = await analyzePropertyInspection(
      imageBase64,
      mimeType,
      propertyDescription || 'Property under inspection',
      asset?.jurisdiction || null,
      asset?.property_type || null,
      regulationTexts,
      orientationHint || null
    )

    return NextResponse.json({ findings })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
