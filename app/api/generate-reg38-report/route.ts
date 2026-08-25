import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReg38Report, Reg38ItemStatus } from '@/lib/anthropic'
import { REG38_ALL_ITEMS } from '@/lib/reg38Checklist'

export const maxDuration = 90

const LEGAL_NOTICE = `

---

IMPORTANT LEGAL / SCOPE NOTE

This report reflects the checklist status recorded in InspectIQ at the time of generation. It is not a statutory certificate and not legal or fire-safety advice, and it is not itself the Responsible Person's acknowledgement required under Regulation 38 or a substitute for the Building Safety Regulator's own assessment of golden thread information under the Building Safety Act 2022. The underlying checklist reflects our best understanding of these requirements, cross-checked against government and regulator guidance rather than the primary legislation directly - have a suitably qualified fire-safety or building-safety professional confirm what applies to this specific building before relying on this document for compliance purposes.`

export async function POST(req: NextRequest) {
  try {
    const { projectId, kind }: { projectId: string; kind: 'status' | 'handover' } = await req.json()

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, company_name, higher_risk_building')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const [{ data: itemRows }, { data: documentRows }] = await Promise.all([
      supabase.from('project_reg38_items').select('item_key, status, notes').eq('project_id', projectId),
      supabase.from('project_reg38_documents').select('item_key, document_name').eq('project_id', projectId),
    ])

    const itemsByKey = new Map((itemRows || []).map((r) => [r.item_key, r]))
    const documentNamesByKey = new Map<string, string[]>()
    ;(documentRows || []).forEach((d: any) => {
      const list = documentNamesByKey.get(d.item_key) || []
      list.push(d.document_name)
      documentNamesByKey.set(d.item_key, list)
    })

    const items: Reg38ItemStatus[] = REG38_ALL_ITEMS.map((def) => {
      const row = itemsByKey.get(def.key)
      return {
        label: def.label,
        regime: def.regime,
        status: (row?.status as Reg38ItemStatus['status']) || 'missing',
        documentNames: documentNamesByKey.get(def.key) || [],
        notes: row?.notes || null,
      }
    })

    let customTemplateText: string | null = null
    if (project.company_name) {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('feature_reg38_custom_template, reg38_template_extracted_text')
        .ilike('company_name', project.company_name)
        .maybeSingle()

      if (settings?.feature_reg38_custom_template && settings.reg38_template_extracted_text) {
        customTemplateText = settings.reg38_template_extracted_text
      }
    }

    const content = await generateReg38Report(
      kind,
      project.name,
      !!project.higher_risk_building,
      items,
      customTemplateText
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: report, error: insertError } = await supabase
      .from('project_reg38_reports')
      .insert({
        project_id: projectId,
        kind,
        content: content + LEGAL_NOTICE,
        generated_by: user?.id,
      })
      .select()
      .single()

    if (insertError || !report) {
      return NextResponse.json({ error: insertError?.message || 'Could not save report' }, { status: 500 })
    }

    return NextResponse.json({ reportId: report.id })
  } catch (err) {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
