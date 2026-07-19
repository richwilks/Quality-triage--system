'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>

        {notifications.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">No notifications yet.</p>
        )}

        <div className="mt-6 space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${
                n.is_read ? 'border-slate-200 bg-white' : 'border-slate-900 bg-slate-50'
              }`}
            >
              <p className="text-sm text-slate-800">{n.message}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(n.created_at).toLocaleString('en-GB')}
              </p>
              <div className="mt-2 flex gap-3">
                <Link
                  href="/dashboard/my-defects"
                  className="text-xs font-medium text-slate-900 underline"
                >
                  View assigned defects
                </Link>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-xs font-medium text-slate-500 underline"
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
