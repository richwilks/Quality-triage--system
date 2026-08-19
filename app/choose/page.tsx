'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChooseProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [hasCopsefieldAccess, setHasCopsefieldAccess] = useState(false)

  useEffect(() => {
    check()
  }, [])

  async function check() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('has_copsefield_access')
      .eq('id', user.id)
      .single()

    // Most accounts only ever have InspectIQ - skip straight there rather than
    // showing a chooser with one real option.
    if (!profile?.has_copsefield_access) {
      router.replace('/dashboard')
      return
    }

    setHasCopsefieldAccess(true)
    setChecking(false)
  }

  if (checking) {
    return (
      <div className="dashboard-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-deck-dim">Loading...</p>
      </div>
    )
  }

  if (!hasCopsefieldAccess) return null

  return (
    <div className="dashboard-shell flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-lg font-semibold text-deck-text">Choose a system</h1>
        <p className="mt-1 text-center text-sm text-deck-dim">
          Your account has access to more than one - pick where you want to go.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex w-full items-center gap-3 rounded-xl border border-deck-border bg-deck-surface p-4 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-deck-accent font-mono text-xs font-bold text-deck-bg">
              IQ
            </div>
            <div>
              <p className="text-sm font-semibold text-deck-text">InspectIQ</p>
              <p className="text-xs text-deck-dim">Quality inspection &amp; defect tracking</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/copsefield')}
            className="flex w-full items-center gap-3 rounded-xl border border-deck-border bg-deck-surface p-4 text-left"
          >
            <img
              src="/branding/copsefield/shield-icon.png"
              alt="Copsefield Group"
              className="h-10 w-10 rounded-md object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-deck-text">Copsefield Group</p>
              <p className="text-xs text-deck-dim">Property inspections &amp; ticket management</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
