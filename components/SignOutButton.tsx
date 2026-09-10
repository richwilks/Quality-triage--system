'use client'

import { createClient } from '@/lib/supabase/client'

export default function SignOutButton({ className }: { className?: string }) {
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button type="button" onClick={handleSignOut} className={className}>
      Sign out
    </button>
  )
}
