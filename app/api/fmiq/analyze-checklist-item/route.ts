import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeChecklistItemPhoto } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { responseId }: { responseId: string } = await req.json()

    const supabase = await createClient()

    const { data: response } = await supabase
      .from('fmiq_inspection_checklist_responses')
      .select('id, item_text, photo_url, status, inspection_id')
      .eq('id', responseId)
      .single()

    if (!response) {
      return NextResponse.json({ error: 'Checklist response not found' }, { status: 404 })
    }
    if (!response.photo_url) {
      return NextResponse.json({ error: 'No photo attached to this item' }, { status: 400 })
    }

    const { data: inspection } = await supabase
      .from('fmiq_inspections')
      .select('asset_id')
      .eq('id', response.inspection_id)
      .single()

    let jurisdiction: string | null = null
    if (inspection?.asset_id) {
      const { data: asset } = await supabase
        .from('fmiq_assets')
        .select('jurisdiction')
        .eq('id', inspection.asset_id)
        .single()
      jurisdiction = asset?.jurisdiction || null
    }

    const photoRes = await fetch(response.photo_url)
    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Could not fetch the photo' }, { status: 500 })
    }
    const buffer = await photoRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = photoRes.headers.get('content-type') || 'image/jpeg'

    const { analysis, severity } = await analyzeChecklistItemPhoto(base64, mimeType, response.item_text, jurisdiction)

    const nextStatus = response.status === 'pending' ? (severity ? 'issue' : 'ok') : response.status

    const { error: updateError } = await supabase
      .from('fmiq_inspection_checklist_responses')
      .update({
        ai_analysis: analysis,
        ai_severity: severity,
        analysis_status: 'done',
        status: nextStatus,
      })
      .eq('id', responseId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ analysis, severity, status: nextStatus })
  } catch (err) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
