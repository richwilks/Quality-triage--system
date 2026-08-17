'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

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
}

type FeatureKey =
  | 'feature_branded_reports'
  | 'feature_hide_inspectiq_brand'
  | 'feature_custom_terminology'
  | 'feature_private_knowledge_base'
  | 'feature_custom_email_sender'

const ACCOUNT_TYPES = ['employee', 'contractor', 'client_agent', 'client']
const TABS = ['Users', 'Projects', 'Invites', 'Branding'] as const

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

  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<Record<string, string>>({})

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
      .select('company_name, white_label_enabled, logo_url, accent_color, feature_branded_reports, feature_hide_inspectiq_brand, feature_custom_terminology, feature_private_knowledge_base, feature_custom_email_sender')
    const brandingMap: Record<string, CompanyBranding> = {}
    ;(brandingData || []).forEach((b: any) => {
      brandingMap[b.company_name] = b
    })
    setCompanyBrandings(brandingMap)

    setLoading(false)
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

    if (has) {
      await supabase.from('project_members').delete().eq('user_id', userId).eq('project_id', projectId)
      setUserProjectIds((prev) => ({ ...prev, [userId]: current.filter((id) => id !== projectId) }))
    } else {
      await supabase.from('project_members').insert({ user_id: userId, project_id: projectId, project_role: 'member' })
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
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'Users' ? 'Search name, email, or company' : 'Search project or company'}
            className="mt-3 w-full rounded-md border border-deck-border px-3 py-2 text-sm"
          />
        )}

        {tab === 'Users' && (
          <div className="mt-4 space-y-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className={`rounded-lg border p-3 ${
                  u.is_blocked ? 'border-red-500/30 bg-red-500/10' : 'border-deck-border bg-deck-surface'
                }`}
              >
                {editingUser === u.id ? (
                  <div className="space-y-2">
                    <input
                      value={u.full_name || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, full_name: e.target.value } : x)))
                      }
                      placeholder="Full name"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <input
                      value={u.company_name || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, company_name: e.target.value } : x)))
                      }
                      placeholder="Company"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <select
                      value={u.account_type || ''}
                      onChange={(e) =>
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, account_type: e.target.value } : x)))
                      }
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
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
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
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
                            <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-[10px] font-medium text-brand-ink">
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
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'border border-red-300 text-red-400'
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
                    <input
                      value={p.name}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="Project name"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <textarea
                      value={p.description || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))
                      }
                      placeholder="Description"
                      rows={2}
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <textarea
                      value={p.standards || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, standards: e.target.value } : x)))
                      }
                      placeholder="Applicable standards"
                      rows={2}
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <input
                      value={p.company_name || ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, company_name: e.target.value } : x)))
                      }
                      placeholder="Company"
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
                    />
                    <select
                      value={p.status}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: e.target.value } : x)))
                      }
                      className="w-full rounded-md border border-deck-border px-2 py-1 text-sm"
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
                          p.status === 'closed' ? 'bg-white/10 text-deck-dim' : 'bg-emerald-500/15 text-emerald-300'
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
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div>
                  <p className="text-sm font-medium text-deck-text">{inv.email}</p>
                  <p className="text-xs text-deck-dim">
                    {getProjectName(inv)} · {inv.project_role} · {inv.account_type || 'no type'}
                  </p>
                </div>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  className="text-xs font-medium text-red-400"
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
              ]
              return (
                <div key={companyName} className="rounded-lg border border-deck-border bg-deck-surface p-3">
                  <p className="text-sm font-medium text-deck-text">{companyName}</p>
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
                                ? 'bg-emerald-500/15 text-emerald-300'
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
      </div>
    </div>
  )
}
