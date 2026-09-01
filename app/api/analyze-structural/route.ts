import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const SOURCE_MODULE = 'mbdd2025-v1'
const DISCIPLINE = 'structural'

type RunPodDetection = {
  defect_class: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

// Calls the RunPod Serverless endpoint hosting the MBDD2025-based structural
// detector (see runpod-structural-detector/ in this repo for the deployment
// package that serves this). Raw detections land in defect_detections -
// upstream of the operational `defects` table - since this is unreviewed
// model output, not a confirmed finding. See lib/defectDetections.ts.
export async function POST(req: NextRequest) {
  const endpointId = process.env.RUNPOD_STRUCTURAL_ENDPOINT_ID
  const apiKey = process.env.RUNPOD_API_KEY

  if (!endpointId || !apiKey) {
    return NextResponse.json(
      {
        error:
          'Structural detection is not configured yet - RUNPOD_STRUCTURAL_ENDPOINT_ID / RUNPOD_API_KEY are not set. See runpod-structural-detector/README.md.',
      },
      { status: 501 }
    )
  }

  try {
    const {
      imageBase64,
      projectId,
      confidenceThreshold,
    }: {
      imageBase64: string
      projectId: string
      confidenceThreshold?: number
    } = await req.json()

    if (!imageBase64 || !projectId) {
      return NextResponse.json({ error: 'imageBase64 and projectId are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    let runpodRes: Response
    try {
      runpodRes = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: {
            image_base64: imageBase64,
            confidence_threshold: confidenceThreshold ?? 0.25,
          },
        }),
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Could not reach the structural detection endpoint: ${err?.message || 'network error'}` },
        { status: 502 }
      )
    }

    const runpodResult = await runpodRes.json()

    if (!runpodRes.ok || runpodResult.status === 'FAILED') {
      return NextResponse.json(
        { error: `Structural detection failed: ${runpodResult.error || runpodRes.status}` },
        { status: 502 }
      )
    }

    const detections: RunPodDetection[] = runpodResult.output?.detections || []

    if (detections.length === 0) {
      return NextResponse.json({ detections: [] })
    }

    const rows = detections.map((d) => ({
      project_id: projectId,
      discipline: DISCIPLINE,
      source_module: SOURCE_MODULE,
      defect_class: d.defect_class,
      confidence: d.confidence,
      bounding_box: d.box,
      conformance_status: 'unassessed',
      created_by: user.id,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('defect_detections')
      .insert(rows)
      .select()

    if (insertError) {
      return NextResponse.json({ error: `Could not save detections: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ detections: inserted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Structural analysis failed' }, { status: 500 })
  }
}
