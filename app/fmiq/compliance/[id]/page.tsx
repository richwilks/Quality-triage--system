'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CameraCapture from '@/components/CameraCapture'

type ScheduledInspection = {
  id: string
  property_id: string
  due_date: string
  status: string
  framework_id: string
  fmiq_assets: { name: string; location: string | null } | { name: string; location: string | null }[] | null
  fmiq_inspection_frameworks:
    | { system_type: string; reference_standard: string; recurrence: string }
    | { system_type: string; reference_standard: string; recurrence: string }[]
    | null
}

type DeficiencyDraft = {
  localId: string
  description: string
  severity: 'minor' | 'moderate' | 'major' | 'hazard'
  correctiveAction: string
  file: File | null
  preview: string | null
}

const SYSTEM_LABEL: Record<string, string> = {
  fire_alarm: 'Fire alarm',
  sprinkler: 'Sprinkler',
  extinguisher: 'Extinguisher',
  emergency_lighting: 'Emergency lighting',
  elevator: 'Elevator',
  backflow: 'Backflow prevention',
  generator: 'Generator',
  other: 'Other',
}

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'bg-deck-raised text-deck-dim',
  moderate: 'bg-amber-100 text-amber-700',
  major: 'bg-orange-100 text-orange-700',
  hazard: 'bg-red-100 text-red-700',
}

function nextDueDate(fromDate: string, recurrence: string): string {
  const d = new Date(fromDate)
  if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'quarterly') d.setMonth(d.getMonth() + 3)
  else if (recurrence === 'semi_annual') d.setMonth(d.getMonth() + 6)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export default function ComplianceCapturePage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const scheduledId = params.id as string

  const [scheduled, setScheduled] = useState<ScheduledInspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [observedCondition, setObservedCondition] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [deficienciesFound, setDeficienciesFound] = useState(false)
  const [deficiencies, setDeficiencies] = useState<DeficiencyDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [scheduledId])

  async function load() {
    const { data } = await supabase
      .from('fmiq_scheduled_inspections')
      .select(
        'id, property_id, due_date, status, framework_id, fmiq_assets(name, location), fmiq_inspection_frameworks(system_type, reference_standard, recurrence)'
      )
      .eq('id', scheduledId)
      .single()
    setScheduled(data as unknown as ScheduledInspection)
    setLoading(false)
  }

  function getAsset(s: ScheduledInspection) {
    if (!s.fmiq_assets) return null
    return Array.isArray(s.fmiq_assets) ? s.fmiq_assets[0] : s.fmiq_assets
  }

  function getFramework(s: ScheduledInspection) {
    if (!s.fmiq_inspection_frameworks) return null
    return Array.isArray(s.fmiq_inspection_frameworks) ? s.fmiq_inspection_frameworks[0] : s.fmiq_inspection_frameworks
  }

  function addDeficiency() {
    setDeficiencies((prev) => [
      ...prev,
      { localId: `${Date.now()}`, description: '', severity: 'moderate', correctiveAction: '', file: null, preview: null },
    ])
  }

  function updateDeficiency(localId: string, patch: Partial<DeficiencyDraft>) {
    setDeficiencies((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)))
  }

  function removeDeficiency(localId: string) {
    setDeficiencies((prev) => prev.filter((d) => d.localId !== localId))
  }

  async function uploadPhoto(f: File, folder: string): Promise<string | null> {
    const filePath = `${folder}/${Date.now()}-${f.name}`
    const { error: uploadError } = await supabase.storage.from('fmiq-compliance-photos').upload(filePath, f)
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`)
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('fmiq-compliance-photos').getPublicUrl(filePath)
    return publicUrl
  }

  async function handleSubmit() {
    if (!scheduled) return
    const framework = getFramework(scheduled)
    setSubmitting(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    let photoUrl: string | null = null
    if (file) {
      photoUrl = await uploadPhoto(file, scheduled.property_id)
      if (!photoUrl) {
        setSubmitting(false)
        return
      }
    }

    const { data: record, error: recordError } = await supabase
      .from('fmiq_compliance_records')
      .insert({
        scheduled_inspection_id: scheduled.id,
        performed_by_user_id: user.id,
        observed_condition: observedCondition.trim() || null,
        photo_evidence: photoUrl ? [photoUrl] : [],
        deficiencies_found: deficienciesFound && deficiencies.length > 0,
      })
      .select()
      .single()

    if (recordError || !record) {
      setError(`Could not save the inspection: ${recordError?.message || 'unknown error'}`)
      setSubmitting(false)
      return
    }

    if (deficienciesFound && deficiencies.length > 0) {
      const rows = []
      for (const d of deficiencies) {
        let defPhotoUrl: string | null = null
        if (d.file) {
          defPhotoUrl = await uploadPhoto(d.file, `${scheduled.property_id}/deficiencies`)
        }
        rows.push({
          compliance_record_id: record.id,
          description: d.description.trim(),
          severity: d.severity,
          photo_evidence: defPhotoUrl ? [defPhotoUrl] : [],
          corrective_action: d.correctiveAction.trim() || null,
        })
      }
      const { error: defError } = await supabase.from('fmiq_deficiencies').insert(rows)
      if (defError) {
        setError(`Inspection saved, but deficiencies could not be saved: ${defError.message}`)
        setSubmitting(false)
        return
      }
    }

    await supabase.from('fmiq_scheduled_inspections').update({ status: 'completed' }).eq('id', scheduled.id)

    if (framework) {
      const { data: current } = await supabase
        .from('fmiq_scheduled_inspections')
        .select('assigned_contractor_org_id')
        .eq('id', scheduled.id)
        .single()

      await supabase.from('fmiq_scheduled_inspections').insert({
        property_id: scheduled.property_id,
        framework_id: scheduled.framework_id,
        due_date: nextDueDate(scheduled.due_date, framework.recurrence),
        status: 'upcoming',
        assigned_contractor_org_id: current?.assigned_contractor_org_id || null,
      })
    }

    router.push('/fmiq/compliance')
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!scheduled) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Task not found.</p>
      </div>
    )
  }

  const asset = getAsset(scheduled)
  const framework = getFramework(scheduled)

  return (
    <div className="min-h-screen px-4 py-8">
      {showCamera && (
        <CameraCapture
          onCapture={(captured: File) => {
            setShowCamera(false)
            setFile(captured)
            setPreview(URL.createObjectURL(captured))
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <div className="mx-auto max-w-md">
        <PageHeader title={asset?.name || 'Compliance Inspection'} />
        <p className="mt-1 text-sm text-deck-body">
          {framework ? SYSTEM_LABEL[framework.system_type] || framework.system_type : ''}
        </p>
        <p className="mt-0.5 text-xs text-deck-dim">
          {framework?.reference_standard} · Due {scheduled.due_date}
        </p>

        {scheduled.status === 'completed' ? (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            <p className="text-sm text-emerald-700">This inspection has already been completed.</p>
            <a
              href={`/fmiq/compliance/${scheduled.id}/certificate`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-fmiq-accent underline"
            >
              View certificate
            </a>
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-deck-body">Observed condition</label>
              <textarea
                value={observedCondition}
                onChange={(e) => setObservedCondition(e.target.value)}
                rows={3}
                placeholder="What did you find during the test?"
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-deck-body">Photo evidence</label>
              <div className="mt-1 flex gap-2">
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
                      if (!f) return
                      setFile(f)
                      setPreview(URL.createObjectURL(f))
                    }}
                  />
                </label>
              </div>
              {preview && <img src={preview} alt="Preview" className="mt-2 w-full rounded-md" />}
            </div>

            <label className="flex items-center gap-2 text-sm text-deck-body">
              <input
                type="checkbox"
                checked={deficienciesFound}
                onChange={(e) => {
                  setDeficienciesFound(e.target.checked)
                  if (e.target.checked && deficiencies.length === 0) addDeficiency()
                }}
              />
              Deficiencies found
            </label>

            {deficienciesFound && (
              <div className="space-y-3">
                {deficiencies.map((d) => (
                  <div key={d.localId} className="rounded-lg border border-deck-border p-3">
                    <div className="flex items-center justify-between">
                      <select
                        value={d.severity}
                        onChange={(e) => updateDeficiency(d.localId, { severity: e.target.value as DeficiencyDraft['severity'] })}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[d.severity]}`}
                      >
                        <option value="minor">Minor</option>
                        <option value="moderate">Moderate</option>
                        <option value="major">Major</option>
                        <option value="hazard">Hazard</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeDeficiency(d.localId)}
                        className="text-xs font-medium text-deck-dim underline"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={d.description}
                      onChange={(e) => updateDeficiency(d.localId, { description: e.target.value })}
                      rows={2}
                      placeholder="Describe the deficiency"
                      className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-sm text-deck-text placeholder:text-deck-mute"
                    />
                    <input
                      type="text"
                      value={d.correctiveAction}
                      onChange={(e) => updateDeficiency(d.localId, { correctiveAction: e.target.value })}
                      placeholder="Recommended corrective action"
                      className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-2 py-1 text-sm text-deck-text placeholder:text-deck-mute"
                    />
                    <label className="mt-2 block cursor-pointer text-xs font-medium text-fmiq-accent underline">
                      {d.file ? 'Photo attached' : 'Attach photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          updateDeficiency(d.localId, { file: f, preview: URL.createObjectURL(f) })
                        }}
                      />
                    </label>
                    {d.preview && <img src={d.preview} alt="Deficiency" className="mt-2 w-full rounded-md" />}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDeficiency}
                  className="w-full rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
                >
                  + Add another deficiency
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Complete inspection'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
