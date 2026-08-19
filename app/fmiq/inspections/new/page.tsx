'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture from '@/components/CameraCapture'

type Asset = { id: string; name: string; jurisdiction: string | null; property_type: string | null }

type ChecklistResponse = {
  id: string
  category: string | null
  item_text: string
  mandatory: boolean
  status: 'pending' | 'ok' | 'issue' | 'not_applicable'
  notes: string
  photo_url: string | null
  ai_analysis: string | null
  ai_severity: 'minor' | 'moderate' | 'major' | 'hazard' | null
  analysis_status: 'none' | 'pending' | 'done'
}

const STATUS_OPTIONS: { value: ChecklistResponse['status']; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'issue', label: 'Issue' },
  { value: 'not_applicable', label: 'N/A' },
]

const STATUS_COLOR: Record<ChecklistResponse['status'], string> = {
  pending: 'bg-deck-raised text-deck-dim',
  ok: 'bg-emerald-100 text-emerald-700',
  issue: 'bg-red-100 text-red-700',
  not_applicable: 'bg-deck-raised text-deck-dim',
}

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'bg-deck-raised text-deck-dim',
  moderate: 'bg-amber-100 text-amber-700',
  major: 'bg-orange-100 text-orange-700',
  hazard: 'bg-red-100 text-red-700',
}

function groupByCategory(responses: ChecklistResponse[]) {
  const groups: { category: string; items: ChecklistResponse[] }[] = []
  for (const r of responses) {
    const cat = r.category || 'General'
    let group = groups.find((g) => g.category === cat)
    if (!group) {
      group = { category: cat, items: [] }
      groups.push(group)
    }
    group.items.push(r)
  }
  return groups
}

function NewInspectionInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialAssetId = searchParams.get('assetId') || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetId, setAssetId] = useState(initialAssetId)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [preparingChecklist, setPreparingChecklist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [responses, setResponses] = useState<ChecklistResponse[]>([])
  const [showCameraFor, setShowCameraFor] = useState<string | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()
    if (!profile?.company_name) return

    const { data: assetData } = await supabase
      .from('fmiq_assets')
      .select('id, name, jurisdiction, property_type')
      .eq('company_name', profile.company_name)
      .order('name', { ascending: true })
    setAssets(assetData || [])
    if (!initialAssetId && assetData && assetData.length > 0) setAssetId(assetData[0].id)
  }

  function getAsset(id: string) {
    return assets.find((a) => a.id === id) || null
  }

  async function handleStart() {
    const asset = getAsset(assetId)
    if (!asset) return
    if (!asset.jurisdiction || !asset.property_type) {
      setError('This property needs a jurisdiction and property type set before an inspection can start - edit the property first.')
      return
    }

    setStarting(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()
    if (!profile?.company_name) {
      setError('Your account has no company set - contact an admin.')
      setStarting(false)
      return
    }

    const { data: inspection, error: insertError } = await supabase
      .from('fmiq_inspections')
      .insert({
        asset_id: assetId,
        company_name: profile.company_name,
        inspector_id: user.id,
      })
      .select()
      .single()

    if (insertError || !inspection) {
      setError(`Could not start the inspection: ${insertError?.message || 'unknown error'}`)
      setStarting(false)
      return
    }

    setInspectionId(inspection.id)
    setStarting(false)
    setPreparingChecklist(true)

    // Find an existing checklist template for this jurisdiction + property
    // type - prefer this company's own edited copy over the shared one.
    let template: { id: string } | null = null
    const { data: companyTemplate } = await supabase
      .from('fmiq_checklist_templates')
      .select('id')
      .ilike('jurisdiction', asset.jurisdiction)
      .eq('property_type', asset.property_type)
      .eq('company_name', profile.company_name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    template = companyTemplate

    if (!template) {
      const { data: sharedTemplate } = await supabase
        .from('fmiq_checklist_templates')
        .select('id')
        .ilike('jurisdiction', asset.jurisdiction)
        .eq('property_type', asset.property_type)
        .is('company_name', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      template = sharedTemplate
    }

    if (!template) {
      const res = await fetch('/api/fmiq/generate-checklist-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jurisdiction: asset.jurisdiction, propertyType: asset.property_type }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(`Could not prepare a checklist: ${result.error || res.status}`)
        setPreparingChecklist(false)
        return
      }
      template = { id: result.templateId }
    }

    const { data: templateItems } = await supabase
      .from('fmiq_checklist_template_items')
      .select('id, category, item_text, mandatory')
      .eq('template_id', template!.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (!templateItems || templateItems.length === 0) {
      setError('That checklist template has no items yet.')
      setPreparingChecklist(false)
      return
    }

    const responseRows = templateItems.map((item, i) => ({
      inspection_id: inspection.id,
      template_item_id: item.id,
      category: item.category,
      item_text: item.item_text,
      mandatory: item.mandatory,
      sort_order: i,
    }))

    const { data: inserted, error: responsesError } = await supabase
      .from('fmiq_inspection_checklist_responses')
      .insert(responseRows)
      .select()

    if (responsesError || !inserted) {
      setError(`Could not set up the checklist: ${responsesError?.message || 'unknown error'}`)
      setPreparingChecklist(false)
      return
    }

    setResponses(inserted as ChecklistResponse[])
    setPreparingChecklist(false)
  }

  function updateLocal(id: string, patch: Partial<ChecklistResponse>) {
    setResponses((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function handleStatusChange(id: string, status: ChecklistResponse['status']) {
    updateLocal(id, { status })
    await supabase.from('fmiq_inspection_checklist_responses').update({ status }).eq('id', id)
  }

  async function handleNotesBlur(id: string, notes: string) {
    await supabase.from('fmiq_inspection_checklist_responses').update({ notes }).eq('id', id)
  }

  async function handlePhotoSelected(id: string, file: File) {
    setUploadingId(id)
    setError(null)
    const path = `${assetId}/checklist-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('fmiq-inspection-photos').upload(path, file)
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`)
      setUploadingId(null)
      return
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('fmiq-inspection-photos').getPublicUrl(path)

    await supabase
      .from('fmiq_inspection_checklist_responses')
      .update({ photo_url: publicUrl, analysis_status: 'pending' })
      .eq('id', id)

    updateLocal(id, { photo_url: publicUrl, analysis_status: 'pending' })
    setUploadingId(null)
  }

  function handleFileChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    handlePhotoSelected(id, selected)
  }

  function handleCameraCapture(id: string, captured: File) {
    setShowCameraFor(null)
    handlePhotoSelected(id, captured)
  }

  async function handleAnalyzeNow(id: string) {
    setAnalyzingId(id)
    setError(null)
    try {
      const res = await fetch('/api/fmiq/analyze-checklist-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId: id }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(`Analysis failed: ${result.error || res.status}`)
        return
      }
      updateLocal(id, {
        ai_analysis: result.analysis,
        ai_severity: result.severity,
        analysis_status: 'done',
        status: result.status,
      })
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || 'unknown'}`)
    } finally {
      setAnalyzingId(null)
    }
  }

  async function handleAddItem() {
    if (!inspectionId || !newItemText.trim()) return
    setAddingItem(true)
    setError(null)

    const { data: inserted, error: insertError } = await supabase
      .from('fmiq_inspection_checklist_responses')
      .insert({
        inspection_id: inspectionId,
        category: newItemCategory.trim() || 'Additional',
        item_text: newItemText.trim(),
        mandatory: false,
        sort_order: responses.length,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      setError(`Could not add item: ${insertError?.message || 'unknown error'}`)
      setAddingItem(false)
      return
    }

    setResponses((prev) => [...prev, inserted as ChecklistResponse])
    setNewItemCategory('')
    setNewItemText('')
    setAddingItem(false)
  }

  async function handleComplete() {
    if (!inspectionId) return
    setCompleting(true)
    await supabase
      .from('fmiq_inspections')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', inspectionId)
    router.push(`/fmiq/inspections/${inspectionId}`)
  }

  const asset = getAsset(assetId)
  const pendingAnalysisCount = responses.filter((r) => r.photo_url && r.analysis_status === 'pending').length

  return (
    <div className="min-h-screen px-4 py-8">
      {showCameraFor && (
        <CameraCapture
          onCapture={(file: File) => handleCameraCapture(showCameraFor, file)}
          onClose={() => setShowCameraFor(null)}
        />
      )}
      <div className="mx-auto max-w-md">
        <PageHeader title="New Inspection" />

        {!inspectionId ? (
          <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            {assets.length === 0 ? (
              <p className="text-sm text-deck-dim">No properties yet - add one first.</p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-deck-body">Property</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {asset && (!asset.jurisdiction || !asset.property_type) && (
                  <p className="mt-1 text-xs text-red-600">
                    This property is missing a jurisdiction or property type - edit it before starting an inspection.
                  </p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleStart}
              disabled={starting || assets.length === 0}
              className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start inspection'}
            </button>
          </div>
        ) : preparingChecklist ? (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 text-center shadow-sm">
            <p className="text-sm text-deck-dim">Preparing the checklist for this property's jurisdiction...</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {pendingAnalysisCount > 0 && (
              <p className="text-xs text-deck-dim">
                {pendingAnalysisCount} photo{pendingAnalysisCount === 1 ? '' : 's'} not yet analyzed - you can
                analyze from here or later from the inspection page.
              </p>
            )}

            {groupByCategory(responses).map((group) => (
              <div key={group.category}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deck-dim">{group.category}</h2>
                <div className="space-y-2">
                  {group.items.map((r) => (
                    <div key={r.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-deck-text">
                          {r.item_text}
                          {r.mandatory && <span className="ml-1 text-xs text-fmiq-accent">*</span>}
                        </p>
                      </div>

                      <div className="mt-2 flex gap-1.5">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleStatusChange(r.id, opt.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              r.status === opt.value ? STATUS_COLOR[opt.value] : 'border border-deck-border text-deck-dim'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        defaultValue={r.notes || ''}
                        onBlur={(e) => handleNotesBlur(r.id, e.target.value)}
                        rows={2}
                        placeholder="Notes (optional)"
                        className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-sm text-deck-text placeholder:text-deck-mute"
                      />

                      {r.photo_url ? (
                        <div className="mt-2">
                          <img src={r.photo_url} alt="Evidence" className="w-full rounded-md" />
                          <div className="mt-2 flex items-center justify-between">
                            {r.ai_severity && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[r.ai_severity]}`}>
                                {r.ai_severity}
                              </span>
                            )}
                            {r.analysis_status !== 'done' && (
                              <button
                                onClick={() => handleAnalyzeNow(r.id)}
                                disabled={analyzingId === r.id}
                                className="ml-auto text-xs font-medium text-fmiq-accent underline disabled:opacity-50"
                              >
                                {analyzingId === r.id ? 'Analyzing...' : 'Analyze now'}
                              </button>
                            )}
                          </div>
                          {r.ai_analysis && <p className="mt-1 text-xs text-deck-dim">{r.ai_analysis}</p>}
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCameraFor(r.id)}
                            disabled={uploadingId === r.id}
                            className="flex-1 rounded-md border border-deck-border px-2 py-1.5 text-xs font-medium text-deck-text disabled:opacity-50"
                          >
                            Take photo
                          </button>
                          <label className="flex-1 cursor-pointer rounded-md border border-deck-border px-2 py-1.5 text-center text-xs font-medium text-deck-text">
                            {uploadingId === r.id ? 'Uploading...' : 'Choose file'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(r.id, e)}
                              className="hidden"
                              disabled={uploadingId === r.id}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-dashed border-deck-border p-3">
              <p className="text-xs font-medium text-deck-body">Add an extra item</p>
              <input
                type="text"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                placeholder="Category (optional)"
                className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-sm text-deck-text placeholder:text-deck-mute"
              />
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="What are you checking?"
                className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-sm text-deck-text placeholder:text-deck-mute"
              />
              <button
                onClick={handleAddItem}
                disabled={addingItem || !newItemText.trim()}
                className="mt-2 w-full rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-text disabled:opacity-50"
              >
                {addingItem ? 'Adding...' : '+ Add item'}
              </button>
            </div>

            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {completing ? 'Finishing...' : 'Complete inspection'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewInspectionInner />
    </Suspense>
  )
}
