'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import FileDropZone from '@/components/FileDropZone'
import { imageToBase64 } from '@/lib/imageToBase64'

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  account_type: string | null
  role: string | null
  company_admin: boolean
  is_platform_admin: boolean
  is_blocked: boolean
}

type ProjectRow = {
  id: string
  name: string
  description: string | null
  standards: string | null
  company_name: string | null
  status: string
}

type InviteRow = {
  id: string
  email: string
  project_role: string
  account_type: string | null
  created_at: string
  projects: { name: string } | { name: string }[] | null
}

type CompanyBranding = {
  company_name: string
  white_label_enabled: boolean
  logo_url: string | null
  accent_color: string | null
  feature_branded_reports: boolean
  feature_hide_inspectiq_brand: boolean
  feature_custom_terminology: boolean
  feature_private_knowledge_base: boolean
  feature_custom_email_sender: boolean
  feature_reg38_custom_template: boolean
}

type FeatureKey =
  | 'feature_branded_reports'
  | 'feature_hide_inspectiq_brand'
  | 'feature_custom_terminology'
  | 'feature_private_knowledge_base'
  | 'feature_custom_email_sender'
  | 'feature_reg38_custom_template'

type InfraNote = {
  id: string
  title: string
  note: string
  status: string
  created_at: string
}

const ACCOUNT_TYPES = ['employee', 'contractor', 'client_agent', 'client']
const TABS = ['Users', 'Projects', 'Invites', 'Branding', 'Structural Test'] as const

export default function PlatformAdminPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Users')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [users, setUsers] = useState<UserRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [userProjectIds, setUserProjectIds] = useState<Record<string, string[]>>({})
  const [companyBrandings, setCompanyBrandings] = useState<Record<string, CompanyBranding>>({})
  const [brandingBusy, setBrandingBusy] = useState<string | null>(null)
  const [infraNotes, setInfraNotes] = useState<InfraNote[]>([])
  const [resolvingNoteId, setResolvingNoteId] = useState<string | null>(null)

  const [testProjectId, setTestProjectId] = useState('')
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testPreview, setTestPreview] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<Record<string, string>>({})
  const [projectToggleError, setProjectToggleError] = useState<Record<string, string>>({})

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
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_platform_admin) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)

    const { data: userData } = await supabase
      .from('profiles')
      .select('id, full_name, email, company_name, account_type, role, company_admin, is_platform_admin, is_blocked')
      .order('company_name', { ascending: true })
    setUsers(userData || [])

    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, description, standards, company_name, status')
      .order('company_name', { ascending: true })
    setProjects(projectData || [])

    const { data: inviteData } = await supabase
      .from('project_invites')
      .select('id, email, project_role, account_type, created_at, projects(name)')
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
    setInvites((inviteData || []) as unknown as InviteRow[])

    const { data: memberData } = await supabase
      .from('project_members')
      .select('project_id, user_id')
    const grouped: Record<string, string[]> = {}
    ;(memberData || []).forEach((m: any) => {
      if (!grouped[m.user_id]) grouped[m.user_id] = []
      grouped[m.user_id].push(m.project_id)
    })
    setUserProjectIds(grouped)

    const { data: brandingData } = await supabase
      .from('company_settings')
      .select('company_name, white_label_enabled, logo_url, accent_color, feature_branded_reports, feature_hide_inspectiq_brand, feature_custom_terminology, feature_private_knowledge_base, feature_custom_email_sender, feature_reg38_custom_template')
    const brandingMap: Record<string, CompanyBranding> = {}
    ;(brandingData || []).forEach((b: any) => {
      brandingMap[b.company_name] = b
    })
    setCompanyBrandings(brandingMap)

    const { data: noteData } = await supabase
      .from('platform_infra_notes')
      .select('id, title, note, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
    setInfraNotes(noteData || [])

    setLoading(false)
  }

  function selectTestFile(files: File[]) {
    const f = files[0]
    if (!f) return
    setTestFile(f)
    setTestPreview(URL.createObjectURL(f))
    setTestResult(null)
  }

  async function runStructuralTest() {
    if (!testFile || !testProjectId) return
    setTesting(true)
    setTestResult(null)
    try {
      const imageBase64 = await imageToBase64(testFile)
      const res = await fetch('/api/analyze-structural', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, projectId: testProjectId }),
      })
      const body = await res.json()
      setTestResult(JSON.stringify({ status: res.status, ...body }, null, 2))
    } catch (err: any) {
      setTestResult(JSON.stringify({ error: err?.message || 'Request failed' }, null, 2))
    }
    setTesting(false)
  }

  async function resolveInfraNote(id: string) {
    setResolvingNoteId(id)
    const { error } = await supabase
      .from('platform_infra_notes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setInfraNotes((prev) => prev.filter((n) => n.id !== id))
    }
    setResolvingNoteId(null)
  }

  function getProjectName(inv: InviteRow) {
    if (!inv.projects) return ''
    return Array.isArray(inv.projects) ? inv.projects[0]?.name : inv.projects.name
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    )
  })

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || (p.company_name || '').toLowerCase().includes(q)
  })

  const distinctCompanies = Array.from(
    new Set(users.map((u) => u.company_name).filter((c): c is string => !!c))
  ).sort()

  async function updateUser(id: string, patch: Partial<UserRow>) {
    await supabase.from('profiles').update(patch).eq('id', id)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  async function updateProject(id: string, patch: Partial<ProjectRow>) {
    await supabase.from('projects').update(patch).eq('id', id)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  async function cancelInvite(id: string) {
    await supabase.from('project_invites').delete().eq('id', id)
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  async function toggleUserProject(userId: string, projectId: string) {
    const current = userProjectIds[userId] || []
    const has = current.includes(projectId)

    setProjectToggleError((prev) => ({ ...prev, [userId]: '' }))

    if (has) {
      const { error } = await supabase.from('project_members').delete().eq('user_id', userId).eq('project_id', projectId)
      if (error) {
        setProjectToggleError((prev) => ({ ...prev, [userId]: error.message }))
        return
      }
      setUserProjectIds((prev) => ({ ...prev, [userId]: current.filter((id) => id !== projectId) }))
    } else {
      const { error } = await supabase.from('project_members').insert({ user_id: userId, project_id: projectId, project_role: 'member' })
      if (error) {
        setProjectToggleError((prev) => ({ ...prev, [userId]: error.message }))
        return
      }
      setUserProjectIds((prev) => ({ ...prev, [userId]: [...current, projectId] }))
    }
  }

  async function sendPasswordReset(email: string, userId: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://inspectiq.co/reset-password',
    })
    setResetMessage((prev) => ({
      ...prev,
      [userId]: error ? 'Failed to send' : 'Reset email sent',
    }))
    setTimeout(() => {
      setResetMessage((prev) => ({ ...prev, [userId]: '' }))
    }, 3000)
  }

  async function toggleBlocked(id: string, current: boolean) {
    await updateUser(id, { is_blocked: !current })
  }

  async function toggleFeature(companyName: string, featureKey: FeatureKey, currentlyEnabled: boolean) {
    setBrandingBusy(companyName)
    const { error } = await supabase.rpc('set_company_feature', {
      target_company: companyName,
      feature_name: featureKey,
      enabled: !currentlyEnabled,
    })
    if (!error) {
      setCompanyBrandings((prev) => ({
        ...prev,
        [companyName]: {
          ...(prev[companyName] || {
            company_name: companyName,
            white_label_enabled: false,
            logo_url: null,
            accent_color: null,
            feature_branded_reports: false,
            feature_hide_inspectiq_brand: false,
            feature_custom_terminology: false,
            feature_private_knowledge_base: false,
            feature_custom_email_sender: false,
            feature_reg38_custom_template: false,
          }),
          [featureKey]: !currentlyEnabled,
        } as CompanyBranding,
      }))
    }
    setBrandingBusy(null)
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
        <PageHeader title="Platform Admin" />
        
 <p className="mt-1 text-sm text-deck-dim">Manage every user, project, and invite directly.</p>

        <div className="mt-3 flex flex-col gap-1">
          <a
            href="/dashboard/admin/analytics"
            className="inline-block text-sm font-medium text-deck-accent"
          >
            View platform analytics →
          </a>
          <a
            href="/dashboard/admin/defect-knowledge"
            className="inline-block text-sm font-medium text-deck-accent"
          >
            Defect knowledge base →
          </a>
        </div>

        {infraNotes.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-deck-mute">
              Infrastructure notes
            </p>
            {infraNotes.map((n) => (
              <div key={n.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-amber-900">{n.title}</p>
                  <button
                    onClick={() => resolveInfraNote(n.id)}
                    disabled={resolvingNoteId === n.id}
                    className="shrink-0 whitespace-nowrap text-xs font-medium text-amber-800 underline disabled:opacity-50"
                  >
                    {resolvingNoteId === n.id ? 'Saving...' : 'Mark resolved'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-amber-800">{n.note}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">

          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t ? 'bg-deck-accent text-deck-bg' : 'border border-deck-border text-deck-body'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {(tab === 'Users' || tab === 'Projects') && (
          <input spellCheck="true"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'Users' ? 'Search name, email, or company' : 'Search project or company'}
            className="mt-3 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
        )}

        {tab === 'Users' && (
          <div className="mt-4 space-y-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className={`rounded-lg border p-3 ${
                  u.is_blocked ? 'border-red-300 bg-red-50' : 'border-deck-border bg-deck-surface'
                }`}
              >
                {editingUser === u.id ? (
                  <div className="space-y-2">
                    <input spellCheck="true"
                      value={u.full_name || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, full_name: e.target.value } : x)))
                      }
                      placeholder="Full name"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <input spellCheck="true"
                      value={u.company_name || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, company_name: e.target.value } : x)))
                      }
                      placeholder="Company"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <select
                      value={u.account_type || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, account_type: e.target.value } : x)))
                      }
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    >
                      <option value="">No type set</option>
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>
                      ))}
                    </select>
                    <select
                      value={u.role || 'internal'}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: e.target.value } : x)))
                      }
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    >
                      <option value="internal">Internal (sees own projects fully)</option>
                      <option value="partner">Partner (sees only assigned defects)</option>
                    </select>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 text-xs text-deck-body">
                        <input
                          type="checkbox"
                          checked={u.company_admin}
                          onChange={(e) =>
                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, company_admin: e.target.checked } : x)))
                          }
                        />
                        Company admin
                      </label>
                      <label className="flex items-center gap-1 text-xs text-deck-body">
                        <input
                          type="checkbox"
                          checked={u.is_platform_admin}
                          onChange={(e) =>
                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_platform_admin: e.target.checked } : x)))
                          }
                        />
                        Platform admin
                      </label>
                    </div>

                    <p className="pt-1 text-xs font-medium text-deck-body">Assigned projects</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-deck-border p-2">
                      {projects.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-xs text-deck-body">
                          <input
                            type="checkbox"
                            checked={(userProjectIds[u.id] || []).includes(p.id)}
                            onChange={() => toggleUserProject(u.id, p.id)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                    {projectToggleError[u.id] && (
                      <p className="pt-1 text-xs text-red-600">{projectToggleError[u.id]}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          updateUser(u.id, {
                            full_name: u.full_name,
                            company_name: u.company_name,
                            account_type: u.account_type,
                            role: u.role,
                            company_admin: u.company_admin,
                            is_platform_admin: u.is_platform_admin,
                          })
                          setEditingUser(null)
                        }}
                        className="flex-1 rounded-md bg-deck-accent px-3 py-1.5 text-xs font-medium text-deck-bg"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="flex-1 rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-body"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-deck-text">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-deck-dim">
                          {u.email} · {u.company_name || 'no company'} · {u.account_type || 'no type'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.company_admin && (
                            <span className="rounded-full bg-deck-accent/10 px-2 py-0.5 text-[10px] font-medium text-deck-accent">
                              Company admin
                            </span>
                          )}
                          {u.is_platform_admin && (
                            <span className="rounded-full bg-deck-mute/20 px-2 py-0.5 text-[10px] font-medium text-deck-text">
                              Platform admin
                            </span>
                          )}
                          {u.is_blocked && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              Blocked
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingUser(u.id)}
                        className="text-xs font-medium text-deck-accent"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => u.email && sendPasswordReset(u.email, u.id)}
                        className="rounded-full border border-deck-border px-2.5 py-1 text-[11px] font-medium text-deck-body"
                      >
                        Send password reset
                      </button>
                      <button
                        onClick={() => toggleBlocked(u.id, u.is_blocked)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          u.is_blocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'border border-red-300 text-red-600'
                        }`}
                      >
                        {u.is_blocked ? 'Unblock login' : 'Block login'}
                      </button>
                      {resetMessage[u.id] && (
                        <span className="text-[11px] text-deck-dim">{resetMessage[u.id]}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'Projects' && (
          <div className="mt-4 space-y-2">
            {filteredProjects.map((p) => (
              <div key={p.id} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                {editingProject === p.id ? (
                  <div className="space-y-2">
                    <input spellCheck="true"
                      value={p.name}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="Project name"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <textarea spellCheck="true"
                      value={p.description || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))
                      }
                      placeholder="Description"
                      rows={2}
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <textarea spellCheck="true"
                      value={p.standards || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, standards: e.target.value } : x)))
                      }
                      placeholder="Applicable standards"
                      rows={2}
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <input spellCheck="true"
                      value={p.company_name || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, company_name: e.target.value } : x)))
                      }
                      placeholder="Company"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    />
                    <select
                      value={p.status}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: e.target.value } : x)))
                      }
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
                    >
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          updateProject(p.id, {
                            name: p.name,
                            description: p.description,
                            standards: p.standards,
                            company_name: p.company_name,
                            status: p.status,
                          })
                          setEditingProject(null)
                        }}
                        className="flex-1 rounded-md bg-deck-accent px-3 py-1.5 text-xs font-medium text-deck-bg"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProject(null)}
                        className="flex-1 rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-body"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-deck-text">{p.name}</p>
                      <p className="text-xs text-deck-dim">{p.company_name || 'no company'}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.status === 'closed' ? 'bg-deck-raised text-deck-dim' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingProject(p.id)}
                      className="text-xs font-medium text-deck-accent"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'Invites' && (
          <div className="mt-4 space-y-2">
            {invites.length === 0 && (
              <p className="text-sm text-deck-dim">No pending invites anywhere.</p>
            )}
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div>
                  <p className="text-sm font-medium text-deck-text">{inv.email}</p>
                  <p className="text-xs text-deck-dim">
                    {getProjectName(inv)} · {inv.project_role} · {inv.account_type || 'no type'}
                  </p>
                </div>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  className="text-xs font-medium text-red-600"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Branding' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-deck-dim">
              Toggle individual white-label features per company. Combine however you want to package them.
            </p>
            {distinctCompanies.length === 0 && (
              <p className="text-sm text-deck-dim">No companies found yet.</p>
            )}
            {distinctCompanies.map((companyName) => {
              const b = companyBrandings[companyName]
              const features: { key: FeatureKey; label: string }[] = [
                { key: 'feature_branded_reports', label: 'Branded reports (logo + colour on exports)' },
                { key: 'feature_hide_inspectiq_brand', label: 'Hide InspectIQ branding entirely' },
                { key: 'feature_custom_terminology', label: 'Custom terminology' },
                { key: 'feature_private_knowledge_base', label: 'Private defect knowledge base' },
                { key: 'feature_custom_email_sender', label: 'Custom email sender name' },
                { key: 'feature_reg38_custom_template', label: 'Custom Regulation 38 / Golden Thread report template' },
              ]
              return (
                <div key={companyName} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                  <p className="text-sm font-medium text-deck-text">{companyName}</p>

                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-deck-mute">InspectIQ</p>
                  {b?.accent_color && (
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-deck-border"
                        style={{ backgroundColor: b.accent_color }}
                      />
                      <span className="text-xs text-deck-dim">{b.accent_color}</span>
                    </div>
                  )}
                  <div className="mt-2 space-y-1.5">
                    {features.map((f) => {
                      const enabled = Boolean(b?.[f.key])
                      return (
                        <div key={f.key} className="flex items-center justify-between">
                          <span className="text-xs text-deck-body">{f.label}</span>
                          <button
                            onClick={() => toggleFeature(companyName, f.key, enabled)}
                            disabled={brandingBusy === companyName}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
                              enabled
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'border border-deck-border text-deck-body'
                            }`}
                          >
                            {enabled ? 'On' : 'Off'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Structural Test' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-deck-dim">
              Calls <span className="font-mono">/api/analyze-structural</span> directly and shows the raw
              response - use this to confirm the RunPod endpoint is reachable and configured, independent of any
              defect-logging UI (which doesn't call this route yet).
            </p>

            <div>
              <label className="block text-xs font-medium text-deck-body">Project</label>
              <select
                value={testProjectId}
                onChange={(e) => setTestProjectId(e.target.value)}
                className="mt-1 w-full rounded-md border border-deck-border px-2 py-1.5 text-sm bg-deck-surface text-deck-text"
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <FileDropZone
              onFiles={selectTestFile}
              accept="image/*"
              className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-deck-border px-3 py-4 text-center text-sm text-deck-dim"
            >
              {testFile ? testFile.name : 'Choose a test photo, or drag and drop it here'}
            </FileDropZone>

            {testPreview && (
              <img src={testPreview} alt="Test preview" className="w-full rounded-md border border-deck-border" />
            )}

            <button
              onClick={runStructuralTest}
              disabled={testing || !testFile || !testProjectId}
              className="w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
            >
              {testing ? 'Calling endpoint...' : 'Run test'}
            </button>

            {testResult && (
              <pre className="overflow-x-auto rounded-md border border-deck-border bg-deck-raised p-3 text-xs text-deck-body">
                {testResult}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
