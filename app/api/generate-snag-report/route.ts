import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSnagReportConclusions } from '@/lib/anthropic'

export const maxDuration = 60

// Sonnet 5 pricing per 1M tokens (adjust if pricing changes)
const INPUT_COST_PER_M = 2.0
const OUTPUT_COST_PER_M = 10.0

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { data: snags } = await supabase
      .from('snags')
      .select('id, description, location')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!snags || snags.length === 0) {
      return NextResponse.json({ error: 'No snags logged yet.' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('home_address')
      .eq('id', user.id)
      .single()

    const { summary, conclusions, usage } = await generateSnagReportConclusions(
      profile?.home_address || null,
      snags.map((s) => ({ id: s.id, description: s.description, location: s.location }))
    )

    const { data: report, error: insertError } = await supabase
      .from('snag_reports')
      .insert({
        user_id: user.id,
        summary,
        conclusions,
        snag_count: snags.length,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (usage) {
      const cost = (usage.input_tokens / 1_000_000) * INPUT_COST_PER_M + (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M
      await supabase.from('analysis_log').insert({
        kind: 'snag_report',
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        estimated_cost: cost,
      })
    }

    return NextResponse.json({ report })
  } catch (err) {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
