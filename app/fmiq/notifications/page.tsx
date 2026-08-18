'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Notification = {
  id: string
  scheduled_inspection_id: string | null
  threshold: string
  message: string
  is_read: boolean
  created_at: string
}

export default function FMIQNotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [noOrg, setNoOrg] = useState(false)

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
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      setNoOrg(true)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('fmiq_notifications')
      .select('id, scheduled_inspection_id, threshold, message, is_read, created_at')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })

    setNotifications(data || [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('fmiq_notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
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
        <PageHeader title="Notifications" />

        {noOrg && (
          <p className="mt-6 text-sm text-deck-dim">
            Your account isn't linked to an organization yet - contact an admin.
          </p>
        )}

        {!noOrg && notifications.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">No notifications yet.</p>
        )}

        <div className="mt-6 space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${
                n.is_read ? 'border-deck-border bg-deck-surface' : 'border-fmiq-accent bg-deck-raised'
              }`}
            >
              <p className="text-sm text-deck-body">{n.message}</p>
              <p className="mt-1 text-xs text-deck-dim">{new Date(n.created_at).toLocaleString('en-GB')}</p>
              {!n.is_read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="mt-2 text-xs font-medium text-deck-dim underline"
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
