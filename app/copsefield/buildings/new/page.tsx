'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import { BUILDING_TYPES, BuildingType, buildingCode } from '@/lib/copsefieldTaxonomy'

type Client = { id: string; name: string }

function NewBuildingInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [buildingType, setBuildingType] = useState<BuildingType>(BUILDING_TYPES[0].value)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [propertyManagerName, setPropertyManagerName] = useState('')
  const [propertyManagerEmail, setPropertyManagerEmail] = useState('')
  const [strataReportFile, setStrataReportFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('copsefield_clients').select('id, name').order('name', { ascending: true })
    setClients(data || [])

    const preset = searchParams.get('clientId')
    if (preset) setClientId(preset)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Building numbers are shared across all building types (100-114 are
    // reserved for Copsefield's own assets, so the register starts at 115).
    const { data: maxRow } = await supabase
      .from('copsefield_buildings')
      .select('building_number')
      .order('building_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = Math.max(115, (maxRow?.building_number || 0) + 1)
    const code = buildingCode(buildingType, nextNumber)

    const { data: building, error: insertError } = await supabase
      .from('copsefield_buildings')
      .insert({
        client_id: clientId || null,
        building_type: buildingType,
        building_number: nextNumber,
        building_code: code,
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        country: country.trim() || null,
        property_manager_name: propertyManagerName.trim() || null,
        property_manager_email: propertyManagerEmail.trim() || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (insertError || !building) {
      setError(insertError?.message || 'Could not save building')
      setSaving(false)
      return
    }

    if (strataReportFile) {
      const path = `${building.id}/${Date.now()}-${strataReportFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('copsefield-strata-reports')
        .upload(path, strataReportFile)

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('copsefield-strata-reports').getPublicUrl(path)
        await supabase.from('copsefield_buildings').update({ strata_report_url: publicUrl }).eq('id', building.id)

        fetch('/api/copsefield/extract-strata-report-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId: building.id }),
        }).catch(() => {})
      }
    }

    router.push(`/copsefield/buildings/${building.id}`)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Add a building" />

        <div className="mt-4 rounded-xl border border-deck-border bg-deck-surface p-5 shadow-sm">
          <label className="block text-sm font-medium text-deck-body">Client</label>
          <div className="mt-1 flex gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link
              href="/copsefield/clients/new"
              className="shrink-0 rounded-md border border-deck-border px-3 py-2 text-sm font-medium text-deck-text"
            >
              + New
            </Link>
          </div>
          {clients.length === 0 && <p className="mt-1 text-xs text-deck-mute">No clients yet - add one first, or leave unlinked for now.</p>}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-deck-body">Building type</label>
              <select
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value as BuildingType)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              >
                {BUILDING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.prefix})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harbourview Strata"
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
              />
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-deck-body">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-deck-body">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. British Columbia"
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text placeholder:text-deck-mute"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-deck-body">Property manager name</label>
              <input
                type="text"
                value={propertyManagerName}
                onChange={(e) => setPropertyManagerName(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-deck-body">Property manager email</label>
              <input
                type="email"
                value={propertyManagerEmail}
                onChange={(e) => setPropertyManagerEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text"
              />
            </div>
          </div>

          {buildingType === 'strata' && (
            <>
              <label className="mt-4 block text-sm font-medium text-deck-body">Most recent strata report (optional)</label>
              <p className="mt-0.5 text-xs text-deck-dim">
                If there's a recent depreciation report, engineering report, or AGM package on file, attach it here - it's kept
                with the building and read for future reports.
              </p>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setStrataReportFile(e.target.files?.[0] || null)}
                className="mt-1 w-full text-sm text-deck-text"
              />
            </>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="mt-5 w-full rounded-md bg-copsefield-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50 lg:w-auto lg:px-8"
        >
          {saving ? 'Saving...' : 'Save building'}
        </button>
      </div>
    </div>
  )
}

export default function NewBuildingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <p className="text-sm text-deck-dim">Loading...</p>
        </div>
      }
    >
      <NewBuildingInner />
    </Suspense>
  )
}
