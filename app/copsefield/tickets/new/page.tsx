'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture from '@/components/CameraCapture'
import PolygonBoxEditor, { Point } from '@/components/PolygonBoxEditor'
import { ASSET_TAXONOMY, ASSET_CATEGORIES, ISSUE_TYPES, PRIORITY_SCALE, buildingCode as formatBuildingCode } from '@/lib/copsefieldTaxonomy'

type Building = { id: string; name: string; building_code: string }

const DEFAULT_POLYGON: Point[] = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 65 },
  { x: 35, y: 65 },
]

async function burnPolygonIntoPhoto(imageUrl: string, points: Point[]): Promise<Blob | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = Math.max(3, canvas.width * 0.004)
        ctx.beginPath()
        points.forEach((p, i) => {
          const px = (p.x / 100) * canvas.width
          const py = (p.y / 100) * canvas.height
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.stroke()
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    img.src = imageUrl
  })
}

function NewTicketInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isStaff, setIsStaff] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [buildingId, setBuildingId] = useState('')
  const [assetCategory, setAssetCategory] = useState('')
  const [component, setComponent] = useState('')
  const [location, setLocation] = useState('')
  const [issueType, setIssueType] = useState('condition')
  const [observation, setObservation] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [priority, setPriority] = useState<number | ''>('')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<Point[]>(DEFAULT_POLYGON)
  const [showCamera, setShowCamera] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('copsefield_role').eq('id', user.id).single()
    const staff = profile?.copsefield_role !== 'owner'
    setIsStaff(staff)

    const { data: buildingData } = await supabase.from('copsefield_buildings').select('id, name, building_code').order('name')
    setBuildings(buildingData || [])

    const preset = searchParams.get('buildingId')
    if (preset) {
      setBuildingId(preset)
    } else if ((buildingData || []).length === 1) {
      setBuildingId(buildingData![0].id)
    }

    setLoading(false)
  }

  function applySelectedPhoto(selected: File) {
    setPhotoFile(selected)
    setPolygonPoints(DEFAULT_POLYGON)
    setPhotoPreview(URL.createObjectURL(selected))
  }

  async function handleSave() {
    if (!buildingId || !assetCategory || !observation.trim()) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const building = buildings.find((b) => b.id === buildingId)

    let photoUrl: string | null = null
    if (photoFile && photoPreview) {
      const burned = await burnPolygonIntoPhoto(photoPreview, polygonPoints)
      const toUpload = burned || photoFile
      const path = `${Date.now()}-${photoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('copsefield-ticket-photos')
        .upload(path, toUpload, { contentType: 'image/jpeg' })
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`)
        setSaving(false)
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('copsefield-ticket-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }

    const { data: maxRow } = await supabase
      .from('copsefield_tickets')
      .select('recommendation_number')
      .eq('building_id', buildingId)
      .order('recommendation_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = (maxRow?.recommendation_number || 0) + 1
    const uniqueRef = `${building?.building_code || formatBuildingCode('strata', 0)}-${String(nextNumber).padStart(3, '0')}`

    const { data: ticket, error: insertError } = await supabase
      .from('copsefield_tickets')
      .insert({
        building_id: buildingId,
        recommendation_number: nextNumber,
        unique_ref: uniqueRef,
        asset_category: assetCategory,
        component: component || null,
        location: location.trim() || null,
        issue_type: isStaff ? issueType : null,
        observation: observation.trim(),
        recommendation: isStaff ? recommendation.trim() || null : null,
        priority: isStaff && priority !== '' ? priority : null,
        status: isStaff ? 'under_review' : 'open',
        photo_url: photoUrl,
        raised_by: user?.id,
        raised_by_type: isStaff ? 'staff' : 'owner_portal',
      })
      .select()
      .single()

    if (insertError || !ticket) {
      setError(insertError?.message || 'Could not save ticket')
      setSaving(false)
      return
    }

    router.push(`/copsefield/tickets/${ticket.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  const components = assetCategory ? ASSET_TAXONOMY[assetCategory] || [] : []

  return (
    <div className="min-h-screen px-4 py-8">
      {showCamera && (
        <CameraCapture
          onCapture={(captured: File) => {
            setShowCamera(false)
            applySelectedPhoto(captured)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Raise a ticket" />
        {!isStaff && (
          <p className="mt-1 text-sm text-deck-dim">
            Describe the issue and Copsefield will review it. You'll be able to see its status here once it's been looked at.
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-deck-body">Building</label>
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          <option value="">Select a building...</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.building_code})
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-deck-body">Category</label>
        <select
          value={assetCategory}
          onChange={(e) => {
            setAssetCategory(e.target.value)
            setComponent('')
          }}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        >
          <option value="">Select a category...</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {components.length > 0 && (
          <>
            <label className="mt-3 block text-sm font-medium text-deck-body">Component (optional)</label>
            <select
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              <option value="">Not specified</option>
              {components.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mt-3 block text-sm font-medium text-deck-body">Location (optional)</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. South Elevation, Unit 204"
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
        />

        {isStaff && (
          <>
            <label className="mt-3 block text-sm font-medium text-deck-body">Issue type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mt-3 block text-sm font-medium text-deck-body">
          {isStaff ? 'Observation' : 'Describe the issue'}
        </label>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
        />

        {isStaff && (
          <>
            <label className="mt-3 block text-sm font-medium text-deck-body">Recommendation (optional)</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            />

            <label className="mt-3 block text-sm font-medium text-deck-body">Priority (optional)</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value ? Number(e.target.value) : '')}
              className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              <option value="">Not set</option>
              {PRIORITY_SCALE.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value} - {p.label}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="mt-3">
          <label className="block text-sm font-medium text-deck-body">Photo (optional)</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
            >
              Take photo
            </button>
            <label className="flex-1 cursor-pointer rounded-md border border-deck-border px-3 py-2 text-center text-sm font-medium text-deck-text">
              Choose from library
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) applySelectedPhoto(f)
                }}
              />
            </label>
          </div>
          {photoPreview && (
            <div className="relative mt-2 w-full">
              <img src={photoPreview} alt="Ticket preview" className="w-full rounded-md" />
              <PolygonBoxEditor points={polygonPoints} onChange={setPolygonPoints} />
              <p className="mt-1 text-xs text-deck-mute">Drag the corners to mark the exact area of the issue.</p>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !buildingId || !assetCategory || !observation.trim()}
          className="mt-5 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Raise ticket'}
        </button>
      </div>
    </div>
  )
}

export default function NewTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewTicketInner />
    </Suspense>
  )
}
