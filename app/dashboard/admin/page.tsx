'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type UserRow = { id: string; full_name: string | null; email: string | null; company_name: string | null; account_type: string | null; company_admin: boolean; is_platform_admin: boolean }
type ProjectRow = { id: string; name: string; company_name: string | null; status: string }

export default function PlatformAdminPage() {
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)

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
      .select('id, full_name, email, company_name, account_type, company_admin, is_platform_admin')
      .order('company_name', { ascending: true })
    setUsers(userData || [])

    const { data: projectData } = await supabase
      .from('projects')
      .select('id, name, company_name, status')
      .order('company_name', { ascending: true })
    setProjects(projectData || [])

    setLoading(false)
  }

  async function toggleCompanyAdmin(userId: string, current: boolean) {
    await supabase.from('profiles').update({ company_admin: !current }).eq('id', userId)
    load()
  }

  async function togglePlatformAdmin(userId: string, current: boolean) {
    await supabase.from('profiles').update({ is_platform_admin: !current }).eq('id', userId)
    load()
  }

  async function toggleProjectStatus(projectId: string, current: string) {
    await supabase
      .from('projects')
      .update({ status: current === 'closed' ? 'active' : 'closed' })
      .eq('id', projectId)
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
        <PageHeader title="Platform Admin" />
        <p className="mt-1 text-sm text-slate-500">Full access across every company and project.</p>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          All projects
        </h2>
        <div className="mt-2 space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.company_name || 'No company set'}</p>
                </div>
                <button
                  onClick={() => toggleProjectStatus(p.id, p.status)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'closed' ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {p.status === 'closed' ? 'Closed - reopen' : 'Active - close'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
          All users
        </h2>
        <div className="mt-2 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-900">{u.full_name || 'Unnamed'}</p>
              <p className="text-xs text-slate-500">
                {u.email} - {u.company_name || 'No company'} - {u.account_type || 'no type'}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => toggleCompanyAdmin(u.id, u.company_admin)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.company_admin ? 'bg-brand-primary text-white' : 'border border-slate-300 text-slate-600'
                  }`}
                >
                  Company admin
                </button>
                <button
                  onClick={() => togglePlatformAdmin(u.id, u.is_platform_admin)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.is_platform_admin ? 'bg-brand-ink text-white' : 'border border-slate-300 text-slate-600'
                  }`}
                >
                  Platform admin
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
