'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string; company_name: string | null }
type LogRow = { project_id: string; company_name: string | null; estimated_cost: number | null; created_at: string }
type CostEntry = {
  id: string
  project_id: string
  label: string
  amount: number
  category: string | null
  entered_at: string
}
type Billing = { company_name: string; monthly_retainer: number; vat_rate_percent: number; notes: string | null }
type CommercialSettings = { default_markup_percent: number }
type ProjectBillingRow = { project_id: string; markup_percent: number | null }

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_VAT_RATE = 20 // UK standard rate - InspectIQ is UK-based

function money(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Per-analysis AI cost is often well under a penny, where money()'s 2dp
// rounds straight to £0.00 - show it in pence with more precision instead.
function unitCost(n: number) {
  if (n < 1) return `${(n * 100).toFixed(3)}p`
  return money(n)
}

export default function CommercialPage() {
  const supabase = createClient()
  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  const [projects, setProjects] = useState<Project[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [costEntries, setCostEntries] = useState<CostEntry[]>([])
  const [billing, setBilling] = useState<Record<string, Billing>>({})

  const [billingDraft, setBillingDraft] = useState<Record<string, { retainer: string; vatRate: string }>>({})
  const [savingCompany, setSavingCompany] = useState<string | null>(null)

  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState(0)
  const [defaultMarkupDraft, setDefaultMarkupDraft] = useState('0')
  const [savingDefaultMarkup, setSavingDefaultMarkup] = useState(false)

  const [projectBilling, setProjectBilling] = useState<Record<string, number | null>>({})
  const [projectMarkupDraft, setProjectMarkupDraft] = useState<Record<string, string>>({})
  const [savingProjectMarkupId, setSavingProjectMarkupId] = useState<string | null>(null)

  const [entryProjectId, setEntryProjectId] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryCategory, setEntryCategory] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setChecked(true)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_commercial_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_commercial_admin) {
      setChecked(true)
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    setChecked(true)

    const [
      { data: projectData },
      { data: logData },
      { data: entryData },
      { data: billingData },
      { data: settingsData },
      { data: projectBillingData },
    ] = await Promise.all([
      supabase.from('projects').select('id, name, company_name'),
      supabase.from('analysis_log').select('project_id, company_name, estimated_cost, created_at'),
      supabase.from('project_cost_entries').select('id, project_id, label, amount, category, entered_at'),
      supabase.from('company_billing').select('company_name, monthly_retainer, vat_rate_percent, notes'),
      supabase.from('commercial_settings').select('default_markup_percent').maybeSingle(),
      supabase.from('project_billing').select('project_id, markup_percent'),
    ])

    setProjects(projectData || [])
    setLogs(logData || [])
    setCostEntries(entryData || [])

    const billingMap: Record<string, Billing> = {}
    const draft: Record<string, { retainer: string; vatRate: string }> = {}
    ;(billingData || []).forEach((b: any) => {
      billingMap[b.company_name] = b
      draft[b.company_name] = { retainer: String(b.monthly_retainer), vatRate: String(b.vat_rate_percent) }
    })
    setBilling(billingMap)
    setBillingDraft(draft)

    const markup = (settingsData as CommercialSettings | null)?.default_markup_percent ?? 0
    setDefaultMarkupPercent(markup)
    setDefaultMarkupDraft(String(markup))

    const projectBillingMap: Record<string, number | null> = {}
    const projectDraft: Record<string, string> = {}
    ;(projectBillingData || []).forEach((row: ProjectBillingRow) => {
      projectBillingMap[row.project_id] = row.markup_percent
      projectDraft[row.project_id] = row.markup_percent === null ? '' : String(row.markup_percent)
    })
    setProjectBilling(projectBillingMap)
    setProjectMarkupDraft(projectDraft)

    if (entryProjectId === '' && (projectData || []).length > 0) setEntryProjectId(projectData![0].id)

    setLoading(false)
  }

  async function handleSaveBilling(companyName: string) {
    setSavingCompany(companyName)
    const draft = billingDraft[companyName] || { retainer: '0', vatRate: String(DEFAULT_VAT_RATE) }
    const retainer = parseFloat(draft.retainer) || 0
    const vatRate = parseFloat(draft.vatRate) || 0
    const { error } = await supabase
      .from('company_billing')
      .upsert(
        { company_name: companyName, monthly_retainer: retainer, vat_rate_percent: vatRate },
        { onConflict: 'company_name' }
      )
    if (!error) {
      setBilling((prev) => ({
        ...prev,
        [companyName]: {
          company_name: companyName,
          monthly_retainer: retainer,
          vat_rate_percent: vatRate,
          notes: prev[companyName]?.notes || null,
        },
      }))
    }
    setSavingCompany(null)
  }

  async function handleSaveDefaultMarkup() {
    setSavingDefaultMarkup(true)
    const value = parseFloat(defaultMarkupDraft) || 0
    const { error } = await supabase
      .from('commercial_settings')
      .upsert({ id: true, default_markup_percent: value }, { onConflict: 'id' })
    if (!error) {
      setDefaultMarkupPercent(value)
    }
    setSavingDefaultMarkup(false)
  }

  async function handleSaveProjectMarkup(projectId: string) {
    setSavingProjectMarkupId(projectId)
    const raw = (projectMarkupDraft[projectId] ?? '').trim()
    const value = raw === '' ? null : parseFloat(raw)
    const { error } = await supabase
      .from('project_billing')
      .upsert({ project_id: projectId, markup_percent: value }, { onConflict: 'project_id' })
    if (!error) {
      setProjectBilling((prev) => ({ ...prev, [projectId]: value }))
    }
    setSavingProjectMarkupId(null)
  }

  async function handleAddCostEntry() {
    if (!entryProjectId || !entryLabel || !entryAmount) return
    setSavingEntry(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('project_cost_entries')
      .insert({
        project_id: entryProjectId,
        label: entryLabel,
        amount: parseFloat(entryAmount) || 0,
        category: entryCategory || null,
        entered_by: user?.id || null,
      })
      .select()
      .single()

    if (!error && data) {
      setCostEntries((prev) => [...prev, data as CostEntry])
      setEntryLabel('')
      setEntryAmount('')
      setEntryCategory('')
    }
    setSavingEntry(false)
  }

  async function handleDeleteCostEntry(id: string) {
    await supabase.from('project_cost_entries').delete().eq('id', id)
    setCostEntries((prev) => prev.filter((e) => e.id !== id))
  }

  if (loading || !checked) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-deck-dim">Page not found.</p>
      </div>
    )
  }

  const now = Date.now()

  const projectStats: Record<
    string,
    { aiCostAll: number; aiCost30: number; countAll: number; count30: number; manualCostAll: number; manualCost30: number }
  > = {}
  function ensureProject(id: string) {
    if (!projectStats[id]) {
      projectStats[id] = { aiCostAll: 0, aiCost30: 0, countAll: 0, count30: 0, manualCostAll: 0, manualCost30: 0 }
    }
    return projectStats[id]
  }

  logs.forEach((l) => {
    if (!l.project_id) return
    const s = ensureProject(l.project_id)
    const cost = l.estimated_cost || 0
    const recent = now - new Date(l.created_at).getTime() <= THIRTY_DAYS_MS
    s.aiCostAll += cost
    s.countAll += 1
    if (recent) {
      s.aiCost30 += cost
      s.count30 += 1
    }
  })

  costEntries.forEach((e) => {
    const s = ensureProject(e.project_id)
    const recent = now - new Date(e.entered_at).getTime() <= THIRTY_DAYS_MS
    s.manualCostAll += e.amount
    if (recent) s.manualCost30 += e.amount
  })

  const projectRows = projects.map((p) => {
    const s = projectStats[p.id] || { aiCostAll: 0, aiCost30: 0, countAll: 0, count30: 0, manualCostAll: 0, manualCost30: 0 }
    const company = p.company_name || 'Unassigned'
    const markup = projectBilling[p.id] ?? defaultMarkupPercent
    const usesDefault = projectBilling[p.id] === undefined || projectBilling[p.id] === null
    const totalCostAll = s.aiCostAll + s.manualCostAll
    const totalCost30 = s.aiCost30 + s.manualCost30
    const usageRevenueAll = totalCostAll * (1 + markup / 100)
    const usageRevenue30 = totalCost30 * (1 + markup / 100)
    return {
      project: p,
      company,
      markup,
      usesDefault,
      aiCostAll: s.aiCostAll,
      manualCostAll: s.manualCostAll,
      totalCostAll,
      countAll: s.countAll,
      usageRevenueAll,
      marginAll: usageRevenueAll - totalCostAll,
      totalCost30,
      usageRevenue30,
    }
  })

  const companyNames = Array.from(new Set(projects.map((p) => p.company_name || 'Unassigned'))).sort()

  const companyRows = companyNames.map((name) => {
    const rows = projectRows.filter((r) => r.company === name)
    const totalCostAll = rows.reduce((sum, r) => sum + r.totalCostAll, 0)
    const usageRevenueAll = rows.reduce((sum, r) => sum + r.usageRevenueAll, 0)
    const totalCost30 = rows.reduce((sum, r) => sum + r.totalCost30, 0)
    const usageRevenue30 = rows.reduce((sum, r) => sum + r.usageRevenue30, 0)
    const aiCostAll = rows.reduce((sum, r) => sum + r.aiCostAll, 0)
    const analysisCountAll = rows.reduce((sum, r) => sum + r.countAll, 0)
    const avgCostPerAnalysis = analysisCountAll > 0 ? aiCostAll / analysisCountAll : null
    const b = billing[name]
    const retainer = b?.monthly_retainer || 0
    const vatRate = b?.vat_rate_percent ?? DEFAULT_VAT_RATE
    const totalRevenueAll = retainer + usageRevenueAll
    const vatAll = totalRevenueAll * (vatRate / 100)
    const marginAll = totalRevenueAll - totalCostAll
    const projectedMonthlyRevenue = retainer + usageRevenue30
    const projectedMonthlyCost = totalCost30
    return {
      name,
      projectCount: rows.length,
      totalCostAll,
      aiCostAll,
      analysisCountAll,
      avgCostPerAnalysis,
      usageRevenueAll,
      totalRevenueAll,
      vatRate,
      vatAll,
      marginAll,
      marginPctAll: totalRevenueAll > 0 ? (marginAll / totalRevenueAll) * 100 : null,
      retainer,
      projectedMonthlyRevenue,
      projectedMonthlyCost,
      projectedMonthlyMargin: projectedMonthlyRevenue - projectedMonthlyCost,
    }
  })

  const mrr = companyRows.reduce((sum, c) => sum + c.projectedMonthlyRevenue, 0)
  const arr = mrr * 12
  const projectedMonthlyCostAll = companyRows.reduce((sum, c) => sum + c.projectedMonthlyCost, 0)
  const projectedMonthlyMarginAll = mrr - projectedMonthlyCostAll
  const totalCostAllTime = companyRows.reduce((sum, c) => sum + c.totalCostAll, 0)
  const totalRevenueAllTime = companyRows.reduce((sum, c) => sum + c.totalRevenueAll, 0)
  const totalAnalysesAllTime = logs.length
  const totalAiCostAllTime = logs.reduce((sum, l) => sum + (l.estimated_cost || 0), 0)
  const avgCostPerAnalysis = totalAnalysesAllTime > 0 ? totalAiCostAllTime / totalAnalysesAllTime : null

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <PageHeader title="Commercial" />
        <p className="mt-1 text-sm text-deck-dim">
          Spend, billing, and forecasts across every company and project - visible only to you.
        </p>

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-4">
          <p className="text-sm font-medium text-deck-body">Default markup</p>
          <p className="mt-0.5 text-xs text-deck-dim">
            Usage revenue = total cost (AI + manual) &times; (1 + markup%). Applies to every project unless that
            project sets its own markup below, overriding this default.
          </p>
          <p className="mt-2 rounded-md bg-deck-raised px-3 py-2 text-sm text-deck-body">
            Actual average AI cost right now:{' '}
            <strong className="text-deck-text">
              {avgCostPerAnalysis === null ? 'no analyses yet' : `${unitCost(avgCostPerAnalysis)} per analysis`}
            </strong>
            {avgCostPerAnalysis !== null && (
              <span className="text-deck-mute"> ({money(totalAiCostAllTime)} across {totalAnalysesAllTime} analyses, all time)</span>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={defaultMarkupDraft}
              onChange={(e) => setDefaultMarkupDraft(e.target.value)}
              className="w-24 rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text"
            />
            <span className="text-sm text-deck-dim">%</span>
            <button
              onClick={handleSaveDefaultMarkup}
              disabled={savingDefaultMarkup}
              className="rounded-md bg-deck-accent px-3 py-1.5 text-xs font-medium text-deck-bg disabled:opacity-50"
            >
              {savingDefaultMarkup ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-brand-ink p-4 text-white">
            <p className="text-2xl font-semibold">{money(mrr)}</p>
            <p className="mt-0.5 text-xs text-white/70">Projected MRR, ex VAT (retainers + trailing 30d usage)</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">{money(arr)}</p>
            <p className="mt-0.5 text-xs text-deck-dim">Projected ARR, ex VAT (MRR &times; 12)</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className="text-2xl font-semibold text-deck-text">{money(projectedMonthlyCostAll)}</p>
            <p className="mt-0.5 text-xs text-deck-dim">Projected monthly cost (trailing 30d)</p>
          </div>
          <div className="rounded-xl border border-deck-border bg-deck-surface p-4">
            <p className={`text-2xl font-semibold ${projectedMonthlyMarginAll >= 0 ? 'text-deck-success' : 'text-red-600'}`}>
              {money(projectedMonthlyMarginAll)}
            </p>
            <p className="mt-0.5 text-xs text-deck-dim">Projected monthly margin</p>
          </div>
        </div>

        <p className="mt-2 text-xs text-deck-mute">
          Projections are a simple trailing-30-day run rate, not a statistical forecast - treat them as a rough
          steer, not a guarantee. All-time totals below are exact, from real usage and manually entered costs.
        </p>

        <div className="mt-3 flex flex-wrap gap-3 text-sm text-deck-body">
          <span>All-time cost: <strong>{money(totalCostAllTime)}</strong></span>
          <span>All-time revenue: <strong>{money(totalRevenueAllTime)}</strong></span>
          <span>All-time margin: <strong className={totalRevenueAllTime - totalCostAllTime >= 0 ? 'text-deck-success' : 'text-red-600'}>{money(totalRevenueAllTime - totalCostAllTime)}</strong></span>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">Billing by company</h2>
        <p className="mt-1 text-xs text-deck-dim">
          VAT defaults to {DEFAULT_VAT_RATE}% (UK standard rate, since InspectIQ is UK-based) - set it to 0% for an
          overseas client not subject to UK VAT, or adjust per company once you've confirmed what actually applies.
          Revenue and margin figures throughout this page are always ex-VAT; VAT is shown separately since it isn't
          InspectIQ's money.
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
          <table className="w-full min-w-[1140px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Monthly retainer</th>
                <th className="px-3 py-2.5 font-medium">VAT %</th>
                <th className="px-3 py-2.5 font-medium">Revenue ex VAT</th>
                <th className="px-3 py-2.5 font-medium">VAT</th>
                <th className="px-3 py-2.5 font-medium">Revenue inc VAT</th>
                <th className="px-3 py-2.5 font-medium">Cost (all time)</th>
                <th className="px-3 py-2.5 font-medium">Avg AI cost / analysis</th>
                <th className="px-3 py-2.5 font-medium">Margin</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {companyRows.map((c) => (
                <tr key={c.name} className="border-b border-deck-border bg-deck-surface last:border-b-0">
                  <td className="px-3 py-2.5 font-medium text-deck-text">
                    {c.name}
                    <span className="ml-1 text-xs text-deck-mute">({c.projectCount} project{c.projectCount === 1 ? '' : 's'})</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      value={billingDraft[c.name]?.retainer ?? '0'}
                      onChange={(e) =>
                        setBillingDraft((prev) => ({
                          ...prev,
                          [c.name]: { retainer: e.target.value, vatRate: prev[c.name]?.vatRate ?? String(DEFAULT_VAT_RATE) },
                        }))
                      }
                      className="w-24 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.1"
                      value={billingDraft[c.name]?.vatRate ?? String(DEFAULT_VAT_RATE)}
                      onChange={(e) =>
                        setBillingDraft((prev) => ({
                          ...prev,
                          [c.name]: { retainer: prev[c.name]?.retainer ?? '0', vatRate: e.target.value },
                        }))
                      }
                      className="w-16 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-deck-body">{money(c.totalRevenueAll)}</td>
                  <td className="px-3 py-2.5 text-deck-dim">{money(c.vatAll)}</td>
                  <td className="px-3 py-2.5 text-deck-body">{money(c.totalRevenueAll + c.vatAll)}</td>
                  <td className="px-3 py-2.5 text-deck-body">{money(c.totalCostAll)}</td>
                  <td className="px-3 py-2.5 text-deck-dim">
                    {c.avgCostPerAnalysis === null ? '-' : unitCost(c.avgCostPerAnalysis)}
                    {c.avgCostPerAnalysis !== null && (
                      <span className="ml-1 text-xs text-deck-mute">({c.analysisCountAll})</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${c.marginAll >= 0 ? 'text-deck-success' : 'text-red-600'}`}>
                    {money(c.marginAll)}
                    {c.marginPctAll !== null && <span className="ml-1 text-xs text-deck-mute">({c.marginPctAll.toFixed(0)}%)</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handleSaveBilling(c.name)}
                      disabled={savingCompany === c.name}
                      className="rounded-md bg-deck-accent px-3 py-1.5 text-xs font-medium text-deck-bg disabled:opacity-50"
                    >
                      {savingCompany === c.name ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
              {companyRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-sm text-deck-dim">
                    No companies yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">Spend & billing by project</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">AI cost</th>
                <th className="px-3 py-2.5 font-medium">Manual cost</th>
                <th className="px-3 py-2.5 font-medium">Total cost</th>
                <th className="px-3 py-2.5 font-medium">Markup %</th>
                <th className="px-3 py-2.5 font-medium">Usage revenue</th>
                <th className="px-3 py-2.5 font-medium">Margin</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map((r) => (
                <Fragment key={r.project.id}>
                  <tr className="border-b border-deck-border bg-deck-surface last:border-b-0">
                    <td className="px-3 py-2.5 font-medium text-deck-text">{r.project.name}</td>
                    <td className="px-3 py-2.5 text-deck-dim">{r.company}</td>
                    <td className="px-3 py-2.5 text-deck-body">
                      {money(r.aiCostAll)}
                      {r.countAll > 0 && (
                        <p className="text-[10px] text-deck-mute">{unitCost(r.aiCostAll / r.countAll)}/analysis &middot; {r.countAll}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-deck-body">{money(r.manualCostAll)}</td>
                    <td className="px-3 py-2.5 font-medium text-deck-text">{money(r.totalCostAll)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          placeholder={`${defaultMarkupPercent}`}
                          value={projectMarkupDraft[r.project.id] ?? ''}
                          onChange={(e) =>
                            setProjectMarkupDraft((prev) => ({ ...prev, [r.project.id]: e.target.value }))
                          }
                          className="w-16 rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                        />
                        <button
                          onClick={() => handleSaveProjectMarkup(r.project.id)}
                          disabled={savingProjectMarkupId === r.project.id}
                          className="text-xs font-medium text-deck-accent underline disabled:opacity-50"
                        >
                          {savingProjectMarkupId === r.project.id ? '...' : 'Save'}
                        </button>
                      </div>
                      {r.usesDefault && <p className="mt-0.5 text-[10px] text-deck-mute">using default</p>}
                    </td>
                    <td className="px-3 py-2.5 text-deck-body">{money(r.usageRevenueAll)}</td>
                    <td className={`px-3 py-2.5 font-medium ${r.marginAll >= 0 ? 'text-deck-success' : 'text-red-600'}`}>
                      {money(r.marginAll)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setExpandedProjectId((prev) => (prev === r.project.id ? null : r.project.id))}
                        className="text-xs font-medium text-deck-accent underline"
                      >
                        {expandedProjectId === r.project.id ? 'Hide costs' : 'Costs'}
                      </button>
                    </td>
                  </tr>
                  {expandedProjectId === r.project.id && (
                    <tr className="border-b border-deck-border bg-deck-raised">
                      <td colSpan={9} className="px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-deck-mute">Manual cost entries</p>
                        <div className="mt-1.5 space-y-1">
                          {costEntries
                            .filter((e) => e.project_id === r.project.id)
                            .map((e) => (
                              <div key={e.id} className="flex items-center justify-between text-xs">
                                <span className="text-deck-body">
                                  {e.label}
                                  {e.category ? ` · ${e.category}` : ''}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium text-deck-text">{money(e.amount)}</span>
                                  <button
                                    onClick={() => handleDeleteCostEntry(e.id)}
                                    className="text-red-600 underline"
                                  >
                                    Remove
                                  </button>
                                </span>
                              </div>
                            ))}
                          {costEntries.filter((e) => e.project_id === r.project.id).length === 0 && (
                            <p className="text-xs text-deck-dim">No manual cost entries on this project.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-sm text-deck-dim">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-deck-dim">Add a manual cost entry</h2>
        <div className="mt-2 rounded-xl border border-deck-border bg-deck-surface p-4">
          <label className="block text-xs font-medium text-deck-body">Project</label>
          <select
            value={entryProjectId}
            onChange={(e) => setEntryProjectId(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="mt-2 block text-xs font-medium text-deck-body">Label</label>
          <input
            type="text"
            value={entryLabel}
            onChange={(e) => setEntryLabel(e.target.value)}
            placeholder="e.g. Inspector day rate - week 3"
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-deck-body">Amount</label>
              <input
                type="number"
                step="0.01"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-deck-body">Category (optional)</label>
              <input
                type="text"
                value={entryCategory}
                onChange={(e) => setEntryCategory(e.target.value)}
                placeholder="e.g. labour, overhead"
                className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
            </div>
          </div>

          <button
            onClick={handleAddCostEntry}
            disabled={savingEntry || !entryProjectId || !entryLabel || !entryAmount}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {savingEntry ? 'Adding...' : 'Add cost entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
