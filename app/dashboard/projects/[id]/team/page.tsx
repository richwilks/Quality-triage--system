'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Member = {
  id: string
  user_id: string
  project_role: string
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
}

export default function ProjectTeamPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const { data } = await supabase
      .from('project_members')
      .select('id, user_id, project_role, profiles(full_name, email)')
      .eq('project_id', projectId)
    setMembers((data || []) as unknown as Member[])
    setLoading(false)
  }

  function getProfile(m: Member) {
    if (!m.profiles) return null
    return Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
  }

  async function handleAdd() {
    if (!email) return
    setAdding(true)
    setError(null)

    const { data: foundProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!foundProfile) {
      setError('No account found with that email. They need to sign up first.')
      setAdding(false)
      return
    }

    const { error: insertError } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: foundProfile.id,
      project_role: role,
    })

    if (insertError) {
      setError('Could not add that person - they may already be on this project.')
    } else {
      setEmail('')
      load()
    }
    setAdding(false)
  }

  async function updateRole(memberId: string, newRole: string) {
    await supabase.from('project_members').update({ project_role: newRole }).eq('id', memberId)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
<PageHeader title="Project Team" />
        <p className="mt-1 text-sm text-slate-500">
          Owners can manage the project and its team. Members can work on defects.
        </p>

        <div className="mt-6 space-y-2">
          {members.map((m) => {
            const profile = getProfile(m)
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {profile?.full_name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-slate-500">{profile?.email}</p>
                </div>
                <select
                  value={m.project_role}
                  onChange={(e) => updateRole(m.id, e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="owner">Owner</option>
                  <option value="member">Member</option>
                </select>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Add a team member</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={adding || !email}
            className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add member'}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            They must already have an account (signed up as Internal) before you can add them.
          </p>
        </div>
      </div>
    </div>
  )
}
