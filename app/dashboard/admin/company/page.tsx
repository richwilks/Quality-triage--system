'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type ProjectRow = { id: string; name: string; status: string }
type UserRow = { id: string; full_name: string | null; email: string | null; account_type: string | null }

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
      </div>
    </div>
  )
}
