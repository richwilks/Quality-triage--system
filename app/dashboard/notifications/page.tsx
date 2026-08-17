'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Notification = {
  id: string
  defect_id: string
  message: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('id, defect_id, message, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setNotifications(data || [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
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

        {notifications.length === 0 && (
          <p className="mt-6 text-sm text-deck-dim">No notifications yet.</p>
        )}

        <div className="mt-6 space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${
                n.is_read ? 'border-deck-border bg-deck-surface' : 'border-deck-accent bg-deck-raised'
              }`}
            >
              <p className="text-sm text-deck-body">{n.message}</p>
              <p className="mt-1 text-xs text-deck-dim">
                {new Date(n.created_at).toLocaleString('en-GB')}
              </p>
              <div className="mt-2 flex gap-3">
                <Link
                  href="/dashboard/my-defects"
                  className="text-xs font-medium text-deck-text underline"
                >
                  View assigned defects
                </Link>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-xs font-medium text-deck-dim underline"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
