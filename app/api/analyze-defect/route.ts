import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDefectImage } from '@/lib/anthropic'

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, projectId } = await request.json()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('description, standards')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const specText = `${project.description || 'No description provided.'}\n\nApplicable standards: ${
      project.standards || 'None specified'
    }`

    const analysis = await analyzeDefectImage(imageBase64, mimeType, specText)

    return NextResponse.json(analysis)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
