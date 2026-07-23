'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Drawing = { id: string; name: string | null; image_url: string | null; project_id: string }

export default function DrawingPinPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const drawingId = params.id as string

  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [drawingId])

  async function load() {
    const { data } = await supabase
      .from('drawings')
      .select('id, name, image_url, project_id')
      .eq('id', drawingId)
      .single()
    setDrawing(data)
    setLoading(false)
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPin({ x, y })
  }

  function handleRaiseDefect() {
    if (!drawing || !pin) return
    const location = `Pinned on ${drawing.name || 'drawing'} (${Math.round(pin.x)}%, ${Math.round(pin.y)}%)`
    const query = new URLSearchParams({
      projectId: drawing.project_id,
      drawingId: drawing.id,
      pinX: pin.x.toFixed(1),
      pinY: pin.y.toFixed(1),
      location,
    })
    router.push(`/dashboard/new-defect?${query.toString()}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!drawing) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Drawing not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
         <PageHeader title="Drawing.Name" />

        <p className="mt-1 text-sm text-slate-500">Tap the drawing to drop a pin at the defect location.</p>

        <div
          className="relative mt-4 w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-200"
          onClick={handleImageClick}
        >
          {drawing.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawing.image_url} alt={drawing.name || 'Drawing'} className="w-full" />
          )}
          {pin && (
            <div
              style={{
                position: 'absolute',
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow" />
            </div>
          )}
        </div>

        {pin && (
          <button
            onClick={handleRaiseDefect}
            className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Raise defect at this location
          </button>
        )}
      </div>
    </div>
  )
}
