'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Template = {
  id: string
  jurisdiction: string
  property_type: string
  name: string
  company_name: string | null
  source: 'ai' | 'manual'
  created_at: string
}

type TemplateItem = {
  id: string
  template_id: string
  category: string | null
  item_text: string
  mandatory: boolean
  source: 'ai' | 'manual'
  basis: 'regulation' | 'general_practice' | null
  sort_order: number
  active: boolean
}

const PROPERTY_TYPES = ['residential', 'commercial', 'mixed_use']

export default function ChecklistTemplatesAdminPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>([])
  const [items, setItems] = useState<Record<string, TemplateItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [genJurisdiction, setGenJurisdiction] = useState('')
  const [genPropertyType, setGenPropertyType] = useState(PROPERTY_TYPES[0])
  const [generating, setGenerating] = useState(false)

  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [newItemCategory, setNewItemCategory] = useState<Record<string, string>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('fmiq_checklist_templates')
      .select('id, jurisdiction, property_type, name, company_name, source, created_at')
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  async function loadItems(templateId: string) {
    const { data } = await supabase
      .from('fmiq_checklist_template_items')
      .select('id, template_id, category, item_text, mandatory, source, basis, sort_order, active')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
    setItems((prev) => ({ ...prev, [templateId]: data || [] }))
  }

  async function toggleExpand(templateId: string) {
    if (expandedId === templateId) {
      setExpandedId(null)
      return
    }
    setExpandedId(templateId)
    if (!items[templateId]) {
      await loadItems(templateId)
    }
  }

  async function handleGenerate() {
    if (!genJurisdiction.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/fmiq/generate-checklist-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jurisdiction: genJurisdiction.trim(), propertyType: genPropertyType }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not generate template')
        setGenerating(false)
        return
      }
      setGenJurisdiction('')
      await load()
      setExpandedId(result.templateId)
      await loadItems(result.templateId)
    } catch (err: any) {
      setError(err?.message || 'Unexpected error')
    }
    setGenerating(false)
  }

  async function handleToggleMandatory(item: TemplateItem) {
    await supabase.from('fmiq_checklist_template_items').update({ mandatory: !item.mandatory }).eq('id', item.id)
    loadItems(item.template_id)
  }

  async function handleToggleActive(item: TemplateItem) {
    await supabase.from('fmiq_checklist_template_items').update({ active: !item.active }).eq('id', item.id)
    loadItems(item.template_id)
  }

  async function handleDeleteItem(item: TemplateItem) {
    await supabase.from('fmiq_checklist_template_items').delete().eq('id', item.id)
    loadItems(item.template_id)
  }

  async function handleAddItem(templateId: string) {
    const text = (newItemText[templateId] || '').trim()
    if (!text) return
    const existing = items[templateId] || []
    await supabase.from('fmiq_checklist_template_items').insert({
      template_id: templateId,
      category: (newItemCategory[templateId] || '').trim() || null,
      item_text: text,
      mandatory: true,
      source: 'manual',
      basis: null,
      sort_order: existing.length,
    })
    setNewItemText((prev) => ({ ...prev, [templateId]: '' }))
    setNewItemCategory((prev) => ({ ...prev, [templateId]: '' }))
    loadItems(templateId)
  }

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) =>
      [t.jurisdiction, t.property_type, t.name, t.company_name].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
    )
  }, [templates, search])

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Checklist Templates" />
        <p className="mt-1 text-sm text-deck-dim">
          Mandatory-item checklists used when starting a new inspection, one per jurisdiction and property type. AI drafts the
          first version - review and adapt the items below.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Generate a new template with AI</p>
          <input
            type="text"
            value={genJurisdiction}
            onChange={(e) => setGenJurisdiction(e.target.value)}
            placeholder="Jurisdiction, e.g. British Columbia"
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />
          <select
            value={genPropertyType}
            onChange={(e) => setGenPropertyType(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          >
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt.replace('_', ' ')}
              </option>
            ))}
          </select>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={generating || !genJurisdiction.trim()}
            className="mt-3 w-full rounded-md bg-fmiq-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate template'}
          </button>
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by jurisdiction, property type, or company..."
            className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
          />

          {templates.length === 0 && <p className="mt-3 text-sm text-deck-dim">No checklist templates yet.</p>}
          {templates.length > 0 && filteredTemplates.length === 0 && (
            <p className="mt-3 text-sm text-deck-dim">No templates match &quot;{search}&quot;.</p>
          )}

          {filteredTemplates.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-lg border border-deck-border">
              {filteredTemplates.map((t) => (
                <Fragment key={t.id}>
                  <button
                    onClick={() => toggleExpand(t.id)}
                    className="flex w-full items-center justify-between border-b border-deck-border bg-deck-surface px-3.5 py-3 text-left last:border-b-0 hover:bg-deck-raised"
                  >
                    <div>
                      <p className="text-sm font-medium text-deck-text">{t.jurisdiction}</p>
                      <p className="text-xs text-deck-dim">
                        {t.property_type.replace('_', ' ')} · {t.company_name ? t.company_name : 'Shared'} ·{' '}
                        {t.source === 'ai' ? 'AI drafted' : 'Manual'}
                      </p>
                    </div>
                    <span className="text-deck-mute">{expandedId === t.id ? '▾' : '→'}</span>
                  </button>

                  {expandedId === t.id && (
                    <div className="border-b border-deck-border bg-deck-raised p-3 last:border-b-0">
                      {!items[t.id] && <p className="text-xs text-deck-dim">Loading items...</p>}
                      {items[t.id] && items[t.id].length === 0 && (
                        <p className="text-xs text-deck-dim">No items in this template yet.</p>
                      )}
                      <div className="space-y-2">
                        {(items[t.id] || []).map((item) => (
                          <div key={item.id} className="rounded-md border border-deck-border bg-deck-surface p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className={`text-sm ${item.active ? 'text-deck-text' : 'text-deck-mute line-through'}`}>
                                  {item.item_text}
                                </p>
                                <p className="mt-0.5 text-xs text-deck-mute">
                                  {item.category || 'General'}
                                  {item.source === 'ai' && item.basis === 'general_practice' && ' · not grounded in an uploaded regulation, double-check'}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  item.mandatory ? 'bg-amber-100 text-amber-700' : 'bg-deck-raised text-deck-dim'
                                }`}
                              >
                                {item.mandatory ? 'Mandatory' : 'Optional'}
                              </span>
                            </div>
                            <div className="mt-2 flex gap-3">
                              <button
                                onClick={() => handleToggleMandatory(item)}
                                className="text-xs font-medium text-fmiq-accent underline"
                              >
                                Mark {item.mandatory ? 'optional' : 'mandatory'}
                              </button>
                              <button
                                onClick={() => handleToggleActive(item)}
                                className="text-xs font-medium text-fmiq-accent underline"
                              >
                                {item.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => handleDeleteItem(item)} className="text-xs font-medium text-red-600">
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-md border border-deck-border bg-deck-surface p-2.5">
                        <input
                          type="text"
                          value={newItemCategory[t.id] || ''}
                          onChange={(e) => setNewItemCategory((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Category (optional)"
                          className="w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-xs text-deck-text placeholder:text-deck-mute"
                        />
                        <input
                          type="text"
                          value={newItemText[t.id] || ''}
                          onChange={(e) => setNewItemText((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Add a checklist item..."
                          className="mt-1.5 w-full rounded-md border border-deck-border bg-deck-surface px-2.5 py-1.5 text-xs text-deck-text placeholder:text-deck-mute"
                        />
                        <button
                          onClick={() => handleAddItem(t.id)}
                          disabled={!(newItemText[t.id] || '').trim()}
                          className="mt-1.5 w-full rounded-md bg-fmiq-accent px-2.5 py-1.5 text-xs font-medium text-deck-bg disabled:opacity-50"
                        >
                          Add item
                        </button>
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
