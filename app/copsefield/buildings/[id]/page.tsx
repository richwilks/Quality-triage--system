'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { BUILDING_TYPES, TICKET_STATUS_COLOR, priorityColor } from '@/lib/copsefieldTaxonomy'

type Building = {
  id: string
  building_code: string
  building_type: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  property_manager_name: string | null
  property_manager_email: string | null
  strata_report_url: string | null
  client_id: string | null
}

type Ticket = {
  id: string
  unique_ref: string
  asset_category: string
  status: string
  priority: number | null
}

type AccessRow = {
  id: string
  user_id: string
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
}

type Report = {
  id: string
  title: string
  published: boolean
  created_at: string
}

type Client = { id: string; name: string }

export default function BuildingDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const buildingId = params.id as string

  const [building, setBuilding] = useState<Building | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [access, setAccess] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [grantEmail, setGrantEmail] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantMessage, setGrantMessage] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [generatingStrataReport, setGeneratingStrataReport] = useState(false)
  const [savingClient, setSavingClient] = useState(false)

  useEffect(() => {
    load()
  }, [buildingId])

  async function load() {
    const { data: buildingData } = await supabase
      .from('copsefield_buildings')
      .select(
        'id, building_code, building_type, name, address, city, region, country, property_manager_name, property_manager_email, strata_report_url, client_id'
      )
      .eq('id', buildingId)
      .single()
    setBuilding(buildingData)

    if (buildingData?.client_id) {
      const { data: clientData } = await supabase.from('copsefield_clients').select('id, name').eq('id', buildingData.client_id).single()
      setClient(clientData)
    }

    const { data: clientList } = await supabase.from('copsefield_clients').select('id, name').order('name', { ascending: true })
    setClients(clientList || [])

    const { data: ticketData } = await supabase
      .from('copsefield_tickets')
      .select('id, unique_ref, asset_category, status, priority')
      .eq('building_id', buildingId)
      .order('recommendation_number', { ascending: true })
    setTickets(ticketData || [])

    const { data: accessData } = await supabase
      .from('copsefield_building_access')
      .select('id, user_id, profiles(full_name, email)')
      .eq('building_id', buildingId)
    setAccess((accessData || []) as unknown as AccessRow[])

    const { data: reportData } = await supabase
      .from('copsefield_property_reports')
      .select('id, title, published, created_at')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })
    setReports(reportData || [])

    setLoading(false)
  }

  function getProfile(a: AccessRow) {
    if (!a.profiles) return null
    return Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
  }

  async function handleChangeClient(newClientId: string) {
    if (!building) return
    setSavingClient(true)
    await supabase.from('copsefield_buildings').update({ client_id: newClientId || null }).eq('id', building.id)
    setBuilding({ ...building, client_id: newClientId || null })
    setClient(clients.find((c) => c.id === newClientId) || null)
    setSavingClient(false)
  }

  async function handleGrantAccess() {
    if (!grantEmail.trim()) return
    setGranting(true)
    setGrantMessage(null)
    try {
      const res = await fetch('/api/copsefield/grant-building-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, email: grantEmail.trim() }),
      })
      const result = await res.json()
      if (!res.ok) {
        setGrantMessage(result.error || 'Could not grant access')
      } else {
        setGrantEmail('')
        setGrantMessage('Access granted.')
        load()
      }
    } catch (err: any) {
      setGrantMessage(err?.message || 'Unexpected error')
    }
    setGranting(false)
  }

  async function handleRevokeAccess(id: string) {
    await supabase.from('copsefield_building_access').delete().eq('id', id)
    setAccess((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleGenerateReport() {
    setGeneratingReport(true)
    try {
      const res = await fetch('/api/copsefield/generate-investment-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId }),
      })
      const result = await res.json()
      if (res.ok) router.push(`/copsefield/reports/${result.reportId}`)
    } catch {}
    setGeneratingReport(false)
  }

  async function handleGenerateStrataReport() {
    setGeneratingStrataReport(true)
    try {
      const res = await fetch('/api/copsefield/generate-strata-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId }),
      })
      const result = await res.json()
      if (res.ok) router.push(`/copsefield/reports/${result.reportId}`)
    } catch {}
    setGeneratingStrataReport(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!building) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Building not found.</p>
      </div>
    )
  }

  const typeLabel = BUILDING_TYPES.find((t) => t.value === building.building_type)?.label || building.building_type

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title={building.name} />
        <p className="mt-1 text-sm text-deck-dim">
          <span className="font-mono">{building.building_code}</span> · {typeLabel}
        </p>
        {building.address && (
          <p className="mt-1 text-sm text-deck-body">
            {building.address}
            {building.city ? `, ${building.city}` : ''}
            {building.region ? `, ${building.region}` : ''}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/copsefield/inspections/new?buildingId=${building.id}`}
            className="rounded-md bg-copsefield-accent px-4 py-2 text-center text-sm font-medium text-deck-bg"
          >
            Start inspection
          </Link>
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="rounded-md border border-copsefield-accent px-4 py-2 text-sm font-medium text-copsefield-accent disabled:opacity-50"
          >
            {generatingReport ? 'Generating...' : 'Property report'}
          </button>
          {building.building_type === 'strata' && (
            <button
              onClick={handleGenerateStrataReport}
              disabled={generatingStrataReport}
              className="rounded-md border border-copsefield-accent px-4 py-2 text-sm font-medium text-copsefield-accent disabled:opacity-50"
            >
              {generatingStrataReport ? 'Generating...' : 'Strata report'}
            </button>
          )}
          {building.strata_report_url && (
            <a
              href={building.strata_report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-text"
            >
              View strata report
            </a>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Reports ({reports.length})</h2>
              {reports.length === 0 && <p className="mt-2 text-sm text-deck-dim">No reports generated for this building yet.</p>}
              {reports.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {reports.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => router.push(`/copsefield/reports/${r.id}`)}
                          className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                        >
                          <td className="px-3 py-2 text-deck-text">{r.title}</td>
                          <td className="px-3 py-2 text-xs text-deck-dim">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.published ? 'bg-emerald-100 text-emerald-700' : 'bg-deck-raised text-deck-dim'
                              }`}
                            >
                              {r.published ? 'Published' : 'Draft'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Tickets ({tickets.length})</h2>
              {tickets.length === 0 && <p className="mt-2 text-sm text-deck-dim">No tickets raised for this building yet.</p>}
              {tickets.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-deck-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-deck-border bg-deck-raised text-xs uppercase tracking-wide text-deck-mute">
                        <th className="px-3 py-2 font-medium">Reference</th>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Priority</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/copsefield/tickets/${t.id}`)}
                          className="cursor-pointer border-b border-deck-border bg-deck-surface last:border-b-0 hover:bg-deck-raised"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-deck-dim">{t.unique_ref}</td>
                          <td className="px-3 py-2 text-deck-text">{t.asset_category}</td>
                          <td className="px-3 py-2">
                            {t.priority !== null ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(t.priority)}`}>P{t.priority}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLOR[t.status]}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Client</h2>
              {client ? (
                <Link href={`/copsefield/clients/${client.id}`} className="mt-2 block text-sm font-medium text-copsefield-accent underline">
                  {client.name}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-deck-dim">Not linked to a client yet.</p>
              )}
              <label className="mt-3 block text-xs font-medium text-deck-body">Reassign</label>
              <select
                value={building.client_id || ''}
                onChange={(e) => handleChangeClient(e.target.value)}
                disabled={savingClient}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                <option value="">Unlinked</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {building.property_manager_name && (
                <p className="mt-3 border-t border-deck-border pt-3 text-xs text-deck-dim">
                  Managed by {building.property_manager_name}
                  {building.property_manager_email ? ` (${building.property_manager_email})` : ''}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-deck-dim">Owner portal access</h2>
              <p className="mt-1 text-xs text-deck-dim">Accounts listed here can log in and raise/view tickets for this building only.</p>
              <div className="mt-2 space-y-1.5">
                {access.map((a) => {
                  const p = getProfile(a)
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-deck-border px-3 py-2">
                      <div>
                        <p className="text-sm text-deck-text">{p?.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-deck-dim">{p?.email}</p>
                      </div>
                      <button onClick={() => handleRevokeAccess(a.id)} className="text-xs font-medium text-red-600">
                        Remove
                      </button>
                    </div>
                  )
                })}
                {access.length === 0 && <p className="text-sm text-deck-dim">No owner accounts linked yet.</p>}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="flex-1 rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
                />
                <button
                  onClick={handleGrantAccess}
                  disabled={granting || !grantEmail.trim()}
                  className="rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
                >
                  {granting ? 'Adding...' : 'Add'}
                </button>
              </div>
              {grantMessage && <p className="mt-2 text-xs text-deck-dim">{grantMessage}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
