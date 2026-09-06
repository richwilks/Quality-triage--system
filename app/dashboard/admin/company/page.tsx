'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'
import { REPORT_LAYOUTS } from '@/lib/reg38ReportLayouts'
import { REPORT_TEMPLATE_TOKENS } from '@/lib/reg38ReportTemplate'

type ProjectRow = { id: string; name: string; status: string }
type UserRow = { id: string; full_name: string | null; email: string | null; account_type: string | null }
type BrandingRow = {
  white_label_enabled: boolean
  logo_url: string | null
  accent_color: string | null
  feature_branded_reports: boolean
  feature_reg38_custom_template: boolean
  reg38_template_name: string | null
  reg38_report_layout: string | null
  feature_reg38_custom_layout: boolean
  reg38_custom_html_template: string | null
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

  const [uploadingTemplate, setUploadingTemplate] = useState(false)
  const [templateMessage, setTemplateMessage] = useState<string | null>(null)

  const [selectedLayout, setSelectedLayout] = useState('classic')
  const [savingLayout, setSavingLayout] = useState(false)
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null)
  const [uploadingCustomLayout, setUploadingCustomLayout] = useState(false)

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
      .select(
        'white_label_enabled, logo_url, accent_color, feature_branded_reports, feature_reg38_custom_template, reg38_template_name, reg38_report_layout, feature_reg38_custom_layout, reg38_custom_html_template'
      )
      .ilike('company_name', profile.company_name)
      .maybeSingle()

    if (brandingData) {
      setBranding(brandingData)
      if (brandingData.accent_color) setAccentColor(brandingData.accent_color)
      if (brandingData.reg38_report_layout) setSelectedLayout(brandingData.reg38_report_layout)
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

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1] || '')
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSaveBranding() {
    setSavingBranding(true)
    setBrandingMessage(null)

    let logoUrl = branding?.logo_url || null

    if (logoFile) {
      const fileBase64 = await fileToBase64(logoFile)
      const res = await fetch('/api/upload-company-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          fileName: logoFile.name,
          mimeType: logoFile.type,
          fileBase64,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        setBrandingMessage(`Logo upload failed: ${result.error || res.status}`)
        setSavingBranding(false)
        return
      }

      logoUrl = result.url
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
        feature_reg38_custom_template: prev?.feature_reg38_custom_template || false,
        reg38_template_name: prev?.reg38_template_name || null,
        reg38_report_layout: prev?.reg38_report_layout || null,
        feature_reg38_custom_layout: prev?.feature_reg38_custom_layout || false,
        reg38_custom_html_template: prev?.reg38_custom_html_template || null,
        logo_url: logoUrl,
        accent_color: accentColor,
      }))
      setLogoFile(null)
    }

    setSavingBranding(false)
  }

  async function handleUploadReg38Template(file: File) {
    setUploadingTemplate(true)
    setTemplateMessage(null)

    const path = `templates/${companyName}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('reg38-documents').upload(path, file)
    if (uploadError) {
      setTemplateMessage(`Upload failed: ${uploadError.message}`)
      setUploadingTemplate(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('reg38-documents').getPublicUrl(path)

    const res = await fetch('/api/extract-reg38-template-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, templateUrl: publicUrl, templateName: file.name }),
    })
    const result = await res.json()

    if (res.ok) {
      setTemplateMessage('Template saved - it will be used the next time a Regulation 38 report is generated.')
      setBranding((prev) => (prev ? { ...prev, reg38_template_name: file.name } : prev))
    } else {
      setTemplateMessage(result.error || 'Could not save template')
    }
    setUploadingTemplate(false)
  }

  async function handleSaveLayout(layoutKey: string) {
    setSavingLayout(true)
    setLayoutMessage(null)

    const { error } = await supabase.rpc('update_company_reg38_layout', {
      target_company: companyName,
      layout_key: layoutKey,
      custom_html: null,
    })

    if (error) {
      setLayoutMessage(`Could not save: ${error.message}`)
    } else {
      setSelectedLayout(layoutKey)
      setBranding((prev) => (prev ? { ...prev, reg38_report_layout: layoutKey } : prev))
      setLayoutMessage('Layout saved.')
    }
    setSavingLayout(false)
  }

  function handleCustomLayoutFile(file: File) {
    setUploadingCustomLayout(true)
    setLayoutMessage(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const html = (event.target?.result as string) || ''
      const { error } = await supabase.rpc('update_company_reg38_layout', {
        target_company: companyName,
        layout_key: selectedLayout,
        custom_html: html,
      })

      if (error) {
        setLayoutMessage(`Could not save custom layout: ${error.message}`)
      } else {
        setBranding((prev) => (prev ? { ...prev, reg38_custom_html_template: html } : prev))
        setLayoutMessage('Custom layout saved - it will be used on your next generated Regulation 38 report.')
      }
      setUploadingCustomLayout(false)
    }
    reader.onerror = () => {
      setLayoutMessage('Could not read that file.')
      setUploadingCustomLayout(false)
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">You don't have access to this page.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Company Admin" />
        <p className="mt-1 text-sm text-deck-dim">{companyName} - projects and users.</p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard/projects/new"
            className="rounded-md bg-deck-accent px-4 py-2 text-sm font-medium text-deck-bg"
          >
            + New project
          </Link>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Projects
        </h2>
        <div className="mt-2 space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3">
              <Link href={`/dashboard/projects/${p.id}`} className="text-sm font-medium text-deck-text">
                {p.name}
              </Link>
              <button
                onClick={() => toggleProjectStatus(p.id, p.status)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === 'closed' ? 'bg-deck-raised text-deck-dim' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {p.status === 'closed' ? 'Closed - reopen' : 'Active - close'}
              </button>
            </div>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-deck-dim">
          Team
        </h2>
        <div className="mt-2 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
              <p className="text-sm font-medium text-deck-text">{u.full_name || 'Unnamed'}</p>
              <p className="text-xs text-deck-dim">{u.email} - {u.account_type || 'no type set'}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Invite to a project</p>
          <select
            value={inviteProjectId}
            onChange={(e) => setInviteProjectId(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
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
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <label className="mt-2 block text-xs font-medium text-deck-body">Account type</label>
          <select
            value={inviteAccountType}
            onChange={(e) => setInviteAccountType(e.target.value)}
            className="mt-1 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-deck-dim">
            {inviteAccountType === 'contractor' || inviteAccountType === 'client'
              ? 'This creates a Supply chain partner - they only see defects assigned to them, not the whole project.'
              : 'Internal team member - sees the whole project, not just what\'s assigned to them.'}
          </p>
          {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>

        {(branding?.feature_branded_reports || branding?.white_label_enabled) && (
          <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
            <p className="text-sm font-medium text-deck-body">Branding</p>
            <p className="mt-1 text-xs text-deck-dim">
              White-label is enabled for your company. Set your logo and accent colour below.
            </p>

            {branding.logo_url && (
              <img
                src={branding.logo_url}
                alt="Current logo"
                className="mt-3 h-12 w-auto rounded-md border border-deck-border object-contain p-2"
              />
            )}

            <label className="mt-3 block text-xs font-medium text-deck-body">Logo</label>
            <FileDropZone
              onFiles={(files) => setLogoFile(files[0])}
              accept="image/*"
              className="mt-1 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
            >
              {logoFile ? logoFile.name : 'Choose a logo, or drag and drop it here'}
            </FileDropZone>

            <label className="mt-3 block text-xs font-medium text-deck-body">Accent colour</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-9 rounded-md border border-deck-border"
              />
              <input spellCheck="true"
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
              />
            </div>

            {brandingMessage && (
              <p className="mt-2 text-sm text-deck-body">{brandingMessage}</p>
            )}

            <button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {savingBranding ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Regulation 38 / Golden Thread report template</p>
          {branding?.feature_reg38_custom_template ? (
            <>
              <p className="mt-1 text-xs text-deck-dim">
                Upload a document with your own report section structure - it'll be used as the template for every
                Regulation 38 status report and handover pack generated on your projects.
              </p>
              {branding.reg38_template_name && (
                <p className="mt-2 text-xs font-medium text-deck-body">Current template: {branding.reg38_template_name}</p>
              )}
              <FileDropZone
                onFiles={(files) => handleUploadReg38Template(files[0])}
                accept=".pdf,.doc,.docx"
                disabled={uploadingTemplate}
                className="mt-3 inline-block cursor-pointer rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body"
              >
                {uploadingTemplate ? 'Uploading...' : branding.reg38_template_name ? 'Replace template' : 'Upload template (or drag and drop)'}
              </FileDropZone>
              {templateMessage && <p className="mt-2 text-sm text-deck-body">{templateMessage}</p>}
            </>
          ) : (
            <p className="mt-1 text-xs text-deck-dim">
              Reports use InspectIQ's standard template. Contact us to unlock uploading your own report template.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Report layout &amp; design</p>
          <p className="mt-1 text-xs text-deck-dim">
            Controls the cover page, contents page, and visual style of generated Regulation 38 / Golden Thread
            reports (separate from the content structure above). Pick one of our layouts, or upload your own.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REPORT_LAYOUTS.map((l) => (
              <button
                key={l.key}
                onClick={() => handleSaveLayout(l.key)}
                disabled={savingLayout}
                className={`rounded-lg border p-3 text-left disabled:opacity-50 ${
                  selectedLayout === l.key && !branding?.reg38_custom_html_template
                    ? 'border-deck-accent bg-deck-raised'
                    : 'border-deck-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.defaultAccent }} />
                  <span className="text-sm font-medium text-deck-text">{l.name}</span>
                  {selectedLayout === l.key && !branding?.reg38_custom_html_template && (
                    <span className="ml-auto text-xs font-medium text-deck-accent">Selected</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-deck-dim">{l.description}</p>
              </button>
            ))}
          </div>

          {branding?.feature_reg38_custom_layout ? (
            <div className="mt-4 border-t border-deck-border pt-4">
              <p className="text-sm font-medium text-deck-body">Custom HTML layout</p>
              <p className="mt-1 text-xs text-deck-dim">
                Upload your own HTML/CSS report design - fonts, colours, and page structure entirely your own. It
                overrides the preset above once uploaded. Use inline &lt;style&gt; only (no external stylesheets or
                scripts - those are stripped for security). Build it around these merge tokens, substituted with
                real report data:
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto rounded-md bg-deck-raised p-2">
                {REPORT_TEMPLATE_TOKENS.map((t) => (
                  <p key={t.token} className="text-[11px] text-deck-dim">
                    <span className="font-mono font-medium text-deck-body">{`{{${t.token}}}`}</span> - {t.description}
                  </p>
                ))}
              </div>
              {branding.reg38_custom_html_template && (
                <p className="mt-2 text-xs font-medium text-deck-success">Custom layout uploaded - currently in use.</p>
              )}
              <FileDropZone
                onFiles={(files) => handleCustomLayoutFile(files[0])}
                accept=".html,.htm"
                disabled={uploadingCustomLayout}
                className="mt-2 inline-block cursor-pointer rounded-md border border-deck-border px-4 py-2 text-sm font-medium text-deck-body"
              >
                {uploadingCustomLayout
                  ? 'Uploading...'
                  : branding.reg38_custom_html_template
                    ? 'Replace custom layout (or drag and drop)'
                    : 'Upload custom layout (or drag and drop)'}
              </FileDropZone>
              {branding.reg38_custom_html_template && (
                <button
                  onClick={() => handleSaveLayout(selectedLayout)}
                  className="ml-3 text-xs font-medium text-red-600 underline"
                >
                  Remove custom layout, use preset
                </button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-deck-dim">
              Contact us to unlock uploading a fully custom HTML report design.
            </p>
          )}

          {layoutMessage && <p className="mt-3 text-sm text-deck-body">{layoutMessage}</p>}
        </div>
      </div>
    </div>
  )
}

