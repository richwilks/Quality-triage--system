'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type ProjectRow = { id: string; name: string; status: string }
type UserRow = { id: string; full_name: string | null; email: string | null; account_type: string | null }
type BrandingRow = {
  white_label_enabled: boolean
  logo_url: string | null
  accent_color: string | null
  feature_branded_reports: boolean
}

const ACCOUNT_TYPES = ['employee', 'contractor', 'client_agent', 'client']

export default function CompanyAdminPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteProjectId, setInviteProjectId] = useState('')
  const [inviteAccountType, setInviteAccountType] = useState('employee')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [branding, setBranding] = useState<BrandingRow | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [accentColor, setAccentColor] = useState('#2C5C57')
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null)

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
      .select('company_admin, company_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_admin || !profile.company_name) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)
    setCompanyName(profile.company_name)

    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, status')
      .ilike('company_name', profile.company_name)
    setProjects(projectData || [])
    if (projectData && projectData.length > 0) setInviteProjectId(projectData[0].id)

    const { data: userData } = await supabase
      .from('profiles')
      .select('id, full_name, email, account_type')
      .ilike('company_name', profile.company_name)
    setUsers(userData || [])

    const { data: brandingData } = await supabase
      .from('company_settings')
      .select('white_label_enabled, logo_url, accent_color, feature_branded_reports')
      .ilike('company_name', profile.company_name)
      .maybeSingle()

    if (brandingData) {
      setBranding(brandingData)
      if (brandingData.accent_color) setAccentColor(brandingData.accent_color)
    }

    setLoading(false)
  }

  async function toggleProjectStatus(projectId: string, current: string) {
    await supabase
      .from('projects')
      .update({ status: current === 'closed' ? 'active' : 'closed' })
      .eq('id', projectId)
    load()
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteProjectId) return
    setInviting(true)
    setMessage(null)

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', inviteEmail)
      .maybeSingle()

    if (existing) {
      await supabase.from('project_members').insert({
        project_id: inviteProjectId,
        user_id: existing.id,
        project_role: 'member',
      })
      await supabase
        .from('profiles')
        .update({ account_type: inviteAccountType })
        .eq('id', existing.id)
      setMessage(`${inviteEmail} added directly.`)
    } else {
      await supabase.from('project_invites').insert({
        project_id: inviteProjectId,
        email: inviteEmail.toLowerCase(),
        project_role: 'member',
        account_type: inviteAccountType,
      })
      setMessage(`Invited ${inviteEmail} - access granted once they sign up or log in.`)
    }

    setInviteEmail('')
    setInviting(false)
    load()
  }

  async function handleSaveBranding() {
    setSavingBranding(true)
    setBrandingMessage(null)

    let logoUrl = branding?.logo_url || null

    if (logoFile) {
      const path = `${companyName}/${Date.now()}-${logoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('company-branding')
        .upload(path, logoFile)

      if (uploadError) {
        setBrandingMessage(`Logo upload failed: ${uploadError.message}`)
        setSavingBranding(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('company-branding').getPublicUrl(path)
      logoUrl = publicUrl
    }

    const { error } = await supabase.rpc('update_company_branding', {
      target_company: companyName,
      logo: logoUrl,
      color: accentColor,
    })

    if (error) {
      setBrandingMessage(`Could not save: ${error.message}`)
    } else {
      setBrandingMessage('Branding saved.')
      setBranding((prev) => ({
        white_label_enabled: prev?.white_label_enabled || false,
        feature_branded_reports: prev?.feature_branded_reports || false,
        logo_url: logoUrl,
        accent_color: accentColor,
      }))
      setLogoFile(null)
    }

    setSavingBranding(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">You don't have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Company Admin" />
        <p className="mt-1 text-sm text-slate-500">{companyName} - projects and users.</p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard/projects/new"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white"
          >
            + New project
          </Link>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Projects
        </h2>
        <div className="mt-2 space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <Link href={`/dashboard/projects/${p.id}`} className="text-sm font-medium text-slate-900">
                {p.name}
              </Link>
              <button
                onClick={() => toggleProjectStatus(p.id, p.status)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === 'closed' ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'
                }`}
              >
                {p.status === 'closed' ? 'Closed - reopen' : 'Active - close'}
              </button>
            </div>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Team
        </h2>
        <div className="mt-2 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-900">{u.full_name || 'Unnamed'}</p>
              <p className="text-xs text-slate-500">{u.email} - {u.account_type || 'no type set'}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Invite to a project</p>
          <select
            value={inviteProjectId}
            onChange={(e) => setInviteProjectId(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="their@email.com"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={inviteAccountType}
            onChange={(e) => setInviteAccountType(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="mt-3 w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>

        {(branding?.feature_branded_reports || branding?.white_label_enabled) && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-700">Branding</p>
            <p className="mt-1 text-xs text-slate-500">
              White-label is enabled for your company. Set your logo and accent colour below.
            </p>

            {branding.logo_url && (
              <img
                src={branding.logo_url}
                alt="Current logo"
                className="mt-3 h-12 w-auto rounded-md border border-slate-200 object-contain p-2"
              />
            )}

            <label className="mt-3 block text-xs font-medium text-slate-600">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />

            <label className="mt-3 block text-xs font-medium text-slate-600">Accent colour</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-9 rounded-md border border-slate-300"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {brandingMessage && (
              <p className="mt-2 text-sm text-slate-600">{brandingMessage}</p>
            )}

            <button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              className="mt-3 w-full rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingBranding ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

