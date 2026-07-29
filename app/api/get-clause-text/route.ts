import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { projectId, standardReference } = await req.json()
    if (!standardReference) {
      return NextResponse.json({ found: false })
    }

    const supabase = await createClient()
    const { data: project } = await supabase
      .from('projects')
      .select('spec_extracted_text, standards')
      .eq('id', projectId)
      .single()

    const sources: { label: string; text: string }[] = []
    if (project?.spec_extracted_text) {
      sources.push({ label: 'Project specification', text: project.spec_extracted_text })
    }

    if (project?.standards) {
      const { data: library } = await supabase
        .from('standards_library')
        .select('code, extracted_text')

      const matches = (library || []).filter(
        (s) => s.extracted_text && project.standards.toLowerCase().includes(s.code.toLowerCase())
      )
      matches.forEach((m) => sources.push({ label: m.code, text: m.extracted_text }))
    }

    const numberMatches = (standardReference.match(/[0-9]+(\.[0-9]+)*/g) || []).sort(
      (a: string, b: string) => b.length - a.length
    )

    for (const source of sources) {
      for (const num of numberMatches) {
        const idx = source.text.indexOf(num)
        if (idx !== -1) {
          const start = Math.max(0, idx - 300)
          const end = Math.min(source.text.length, idx + 500)
          const snippet = (start > 0 ? '...' : '') + source.text.slice(start, end).trim() + (end < source.text.length ? '...' : '')
          return NextResponse.json({ found: true, source: source.label, snippet })
        }
      }
    }

    return NextResponse.json({ found: false })
  } catch (err) {
    return NextResponse.json({ found: false })
  }
}
