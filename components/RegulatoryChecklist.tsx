'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import StackedBar from '@/components/charts/StackedBar'
import FileDropZone from '@/components/FileDropZone'
import { REG38_ITEMS, GOLDEN_THREAD_ITEMS, Reg38ItemDef, Reg38Regime } from '@/lib/reg38Checklist'

type Project = { id: string; name: string; higher_risk_building: boolean }
type ItemRow = {
  item_key: string
  status: 'missing' | 'uploaded' | 'approved'
  notes: string | null
}
type DocumentRow = {
  id: string
  item_key: string
  document_url: string
  document_name: string
}

const STATUS_LABELS: Record<ItemRow['status'], string> = {
  missing: 'Missing',
  uploaded: 'Uploaded - awaiting review',
  approved: 'Approved',
}

const STATUS_COLORS: Record<ItemRow['status'], string> = {
  missing: 'text-status-rejected',
  uploaded: 'text-status-assigned',
  approved: 'text-status-closed',
}

export default function RegulatoryChecklist({ regime }: { regime: Reg38Regime }) {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const regimeItems = regime === 'reg38' ? REG38_ITEMS : GOLDEN_THREAD_ITEMS
  const pageTitle = regime === 'reg38' ? 'Regulation 38' : 'Golden Thread'

  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<Record<string, ItemRow>>({})
  const [documents, setDocuments] = useState<Record<string, DocumentRow[]>>({})
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<'status' | 'handover' | null>(null)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, higher_risk_building')
      .eq('id', projectId)
      .single()
    setProject(projectData)

    const [{ data: itemData }, { data: documentData }] = await Promise.all([
      supabase.from('project_reg38_items').select('item_key, status, notes').eq('project_id', projectId),
      supabase
        .from('project_reg38_documents')
        .select('id, item_key, document_url, document_name')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: true }),
    ])

    const byKey: Record<string, ItemRow> = {}
    ;(itemData || []).forEach((r: any) => {
      byKey[r.item_key] = r
    })
    setItems(byKey)

    const docsByKey: Record<string, DocumentRow[]> = {}
    ;(documentData || []).forEach((d: any) => {
      if (!docsByKey[d.item_key]) docsByKey[d.item_key] = []
      docsByKey[d.item_key].push(d)
    })
    setDocuments(docsByKey)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const [{ data: membership }, { data: profile }] = await Promise.all([
        supabase
          .from('project_members')
          .select('project_role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
      ])
      setIsOwner(membership?.project_role === 'owner' || !!profile?.is_platform_admin)
    }

    setLoading(false)
  }

  async function handleUpload(item: Reg38ItemDef, files: File[]) {
    setUploadingKey(item.key)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const uploaded: DocumentRow[] = []
    for (const file of files) {
      const path = `${projectId}/${item.key}-${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('reg38-documents').upload(path, file)
      if (uploadError) {
        setError(`Upload failed for ${file.name}: ${uploadError.message}`)
        continue
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('reg38-documents').getPublicUrl(path)

      const { data: docRow, error: insertError } = await supabase
        .from('project_reg38_documents')
        .insert({
          project_id: projectId,
          item_key: item.key,
          document_url: publicUrl,
          document_name: file.name,
          uploaded_by: user?.id,
        })
        .select('id, item_key, document_url, document_name')
        .single()

      if (insertError || !docRow) {
        setError(`Could not save ${file.name}: ${insertError?.message || 'unknown error'}`)
        continue
      }
      uploaded.push(docRow as DocumentRow)
    }

    if (uploaded.length > 0) {
      setDocuments((prev) => ({ ...prev, [item.key]: [...(prev[item.key] || []), ...uploaded] }))

      const currentStatus = items[item.key]?.status
      if (!currentStatus || currentStatus === 'missing') {
        const { error: upsertError } = await supabase.from('project_reg38_items').upsert(
          { project_id: projectId, item_key: item.key, regime: item.regime, status: 'uploaded' },
          { onConflict: 'project_id,item_key' }
        )
        if (!upsertError) {
          setItems((prev) => ({
            ...prev,
            [item.key]: { item_key: item.key, status: 'uploaded', notes: prev[item.key]?.notes || null },
          }))
        }
      }
    }

    setUploadingKey(null)
  }

  async function handleDeleteDocument(itemKey: string, docId: string) {
    setDocuments((prev) => ({ ...prev, [itemKey]: (prev[itemKey] || []).filter((d) => d.id !== docId) }))
    await supabase.from('project_reg38_documents').delete().eq('id', docId)
  }

  async function handleApprove(itemKey: string) {
    const { error: updateError } = await supabase
      .from('project_reg38_items')
      .update({ status: 'approved' })
      .eq('project_id', projectId)
      .eq('item_key', itemKey)

    if (!updateError) {
      setItems((prev) => ({ ...prev, [itemKey]: { ...prev[itemKey], status: 'approved' } }))
    }
  }

  async function handleGenerate(kind: 'status' | 'handover') {
    setGenerating(kind)
    setError(null)

    const res = await fetch('/api/generate-reg38-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, kind }),
    })
    const result = await res.json()

    if (res.ok) {
      router.push(`/dashboard/projects/${projectId}/reg38/report?reportId=${result.reportId}`)
    } else {
      setError(result.error || 'Could not generate report')
      setGenerating(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Project not found.</p>
      </div>
    )
  }

  const counts = { missing: 0, uploaded: 0, approved: 0 }
  regimeItems.forEach((def) => {
    const status = items[def.key]?.status || 'missing'
    counts[status]++
  })

  const statusSegments = [
    { label: 'Missing', value: counts.missing, colorClass: 'bg-status-rejected' },
    { label: 'Uploaded', value: counts.uploaded, colorClass: 'bg-status-assigned' },
    { label: 'Approved', value: counts.approved, colorClass: 'bg-status-closed' },
  ]

  function renderItem(def: Reg38ItemDef) {
    const row = items[def.key]
    const status = row?.status || 'missing'
    const docs = documents[def.key] || []
    const isUploading = uploadingKey === def.key

    return (
      <FileDropZone
        key={def.key}
        onFiles={(files) => handleUpload(def, files)}
        multiple
        disabled={isUploading}
        className="cursor-pointer rounded-lg border border-deck-border bg-deck-surface p-3 transition-colors"
        dragActiveClassName="border-deck-accent bg-deck-raised ring-2 ring-deck-accent"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-deck-text">{def.label}</p>
          <span className={`shrink-0 text-xs font-semibold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
        </div>
        <p className="mt-1 text-xs text-deck-dim">{def.guidance}</p>

        {docs.length > 0 && (
          <div className="mt-2 space-y-1">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-deck-raised px-2 py-1">
                <a
                  href={d.document_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-xs font-medium text-deck-accent underline"
                >
                  {d.document_name}
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteDocument(def.key, d.id)
                  }}
                  aria-label={`Remove ${d.document_name}`}
                  className="shrink-0 text-sm font-bold leading-none text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-deck-mute">
            {isUploading
              ? 'Uploading...'
              : docs.length > 0
                ? 'Drop more documents anywhere here, or click to browse'
                : 'Drop documents anywhere here, or click to browse'}
          </p>
          {isOwner && status === 'uploaded' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleApprove(def.key)
              }}
              className="shrink-0 text-xs font-medium text-deck-success underline"
            >
              Approve
            </button>
          )}
        </div>
      </FileDropZone>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={pageTitle} />
        <p className="mt-1 text-sm text-deck-dim">
          {project.name} -{' '}
          {regime === 'reg38'
            ? 'fire safety information handover to the Responsible Person.'
            : 'building safety record-keeping under the Building Safety Act 2022.'}
        </p>
        <Link
          href={`/dashboard/projects/${projectId}/${regime === 'reg38' ? 'golden-thread' : 'reg38'}`}
          className="mt-1 inline-block text-xs font-medium text-deck-accent underline"
        >
          {regime === 'reg38' ? 'View Golden Thread checklist →' : 'View Regulation 38 checklist →'}
        </Link>

        {regime === 'golden_thread' && !project.higher_risk_building && (
          <p className="mt-2 text-xs text-deck-mute">
            Not flagged as a Higher-Risk Building - the items below are recommended practice, not a legal
            requirement.{' '}
            <Link href={`/dashboard/projects/${projectId}/edit`} className="underline">
              Change this
            </Link>
            .
          </p>
        )}

        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          This checklist reflects our best understanding of {regime === 'reg38' ? 'Regulation 38' : 'Golden Thread'}{' '}
          (Building Safety Act 2022) requirements, but is not a substitute for legal or fire-safety advice. Have your
          Principal Accountable Person, fire engineer, or building safety professional confirm what's required for
          this specific building before relying on this for compliance.
        </p>

        <div className="mt-4 rounded-md border border-deck-border bg-deck-surface p-4">
          <StackedBar segments={statusSegments} />
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleGenerate('status')}
            disabled={generating !== null}
            className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-body disabled:opacity-50"
          >
            {generating === 'status' ? 'Generating...' : 'Generate status report'}
          </button>
          <button
            onClick={() => handleGenerate('handover')}
            disabled={generating !== null}
            className="flex-1 rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {generating === 'handover' ? 'Generating...' : 'Generate handover pack'}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-deck-dim">
          The generated report/pack covers both Regulation 38 and Golden Thread together, so it's the same document
          from either checklist page.
        </p>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">{pageTitle}</h2>
        <p className="mt-1 text-xs text-deck-dim">
          {regime === 'reg38'
            ? 'Fire safety information to hand to the Responsible Person by completion or occupation, whichever is earlier.'
            : project.higher_risk_building
              ? 'Legally required for this Higher-Risk Building under the Building Safety Act 2022.'
              : 'Recommended record-keeping - only legally mandatory for Higher-Risk Buildings.'}
        </p>
        <p className="mt-1 text-xs text-deck-mute">
          Each item takes as many documents as you need - two or twenty. Drop them anywhere on that item's box.
        </p>
        <div className="mt-2 space-y-2">{regimeItems.map(renderItem)}</div>
      </div>
    </div>
  )
}
