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

type Invite = {
  id: string
  email: string
  project_role: string
  created_at: string
}

export default function ProjectTeamPage() {
  const supabase = createClient()
  const params = useParams()
  const projectId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
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

    const { data: inviteData } = await supabase
      .from('project_invites')
      .select('id, email, project_role, created_at')
      .eq('project_id', projectId)
      .is('accepted_at', null)
    setInvites(inviteData || [])

    setLoading(false)
  }

  function getProfile(m: Member) {
    if (!m.profiles) return null
    return Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
  }

  async function handleInvite() {
    if (!email) return
    setAdding(true)
    setError(null)
    setMessage(null)

    const { data: foundProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (foundProfile) {
      const { error: insertError } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: foundProfile.id,
        project_role: role,
      })
      if (insertError) {
        setError('Could not add that person - they may already be on this project.')
      } else {
        setMessage(`${email} added directly - they already had an account.`)
        setEmail('')
        load()
      }
    } else {
      const { error: inviteError } = await supabase.from('project_invites').insert({
        project_id: projectId,
        email: email.toLowerCase(),
        project_role: role,
      })
      if (inviteError) {
        setError('Could not send that invite - it may already be pending.')
      } else {
        setMessage(`Invited ${email} - they'll get access once they sign up or log in with that email.`)
        setEmail('')
        load()
      }
    }

    setAdding(false)
  }

  async function updateRole(memberId: string, newRole: string) {
    await supabase.from('project_members').update({ project_role: newRole }).eq('id', memberId)
    load()
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from('project_invites').delete().eq('id', inviteId)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Project Team" />
        <p className="mt-1 text-sm text-deck-dim">
          Invite people by email - they only get access once accepted, either instantly if they already have an account, or automatically the next time they sign up or log in.
        </p>

        <div className="mt-6 space-y-2">
          {members.map((m) => {
            const profile = getProfile(m)
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-deck-border bg-deck-surface p-3"
              >
                <div>
                  <p className="text-sm font-medium text-deck-text">
                    {profile?.full_name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-deck-dim">{profile?.email}</p>
                </div>
                <select
                  value={m.project_role}
                  onChange={(e) => updateRole(m.id, e.target.value)}
                  className="rounded-md border border-deck-border px-2 py-1 text-xs bg-deck-surface text-deck-text placeholder:text-deck-mute"
                >
                  <option value="owner">Owner</option>
                  <option value="member">Member</option>
                </select>
              </div>
            )
          })}

          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-deck-text">{inv.email}</p>
                <p className="text-xs text-amber-700">Invited - pending ({inv.project_role})</p>
              </div>
              <button
                onClick={() => cancelInvite(inv.id)}
                className="text-xs font-medium text-red-600 underline"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-deck-body">Invite someone</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-2 w-full rounded-md border border-deck-border px-3 py-2 text-sm bg-deck-surface text-deck-text placeholder:text-deck-mute"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
          <button
            onClick={handleInvite}
            disabled={adding || !email}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {adding ? 'Sending...' : 'Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}
