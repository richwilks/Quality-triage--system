import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateChecklistTemplate, RegulationText } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const {
      jurisdiction,
      propertyType,
    }: { jurisdiction: string; propertyType: string } = await req.json()

    if (!jurisdiction?.trim() || !propertyType) {
      return NextResponse.json({ error: 'Jurisdiction and property type are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { data: regulations } = await supabase
      .from('fmiq_regulations_library')
      .select('code, extracted_text, jurisdiction')
      .not('extracted_text', 'is', null)

    const jurisdictionNormalized = jurisdiction.toLowerCase().trim()
    const regulationTexts: RegulationText[] = (regulations || [])
      .filter((r) => !r.jurisdiction || r.jurisdiction.toLowerCase().trim() === jurisdictionNormalized)
      .map((r) => ({ code: r.code, text: r.extracted_text }))

    const { items } = await generateChecklistTemplate(jurisdiction, propertyType, regulationTexts)

    if (items.length === 0) {
      return NextResponse.json({ error: 'Could not generate any checklist items' }, { status: 500 })
    }

    const { data: template, error: templateError } = await supabase
      .from('fmiq_checklist_templates')
      .insert({
        jurisdiction: jurisdiction.trim(),
        property_type: propertyType,
        name: `${jurisdiction.trim()} - ${propertyType}`,
        source: 'ai',
        created_by: user.id,
      })
      .select()
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: templateError?.message || 'Could not save template' }, { status: 500 })
    }

    const itemRows = items.map((item, i) => ({
      template_id: template.id,
      category: item.category,
      item_text: item.item_text,
      mandatory: item.mandatory,
      source: 'ai',
      basis: item.source,
      sort_order: i,
    }))

    const { error: itemsError } = await supabase.from('fmiq_checklist_template_items').insert(itemRows)
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json({ templateId: template.id })
  } catch (err) {
    return NextResponse.json({ error: 'Template generation failed' }, { status: 500 })
  }
}
