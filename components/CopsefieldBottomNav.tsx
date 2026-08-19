'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ACTIVE = '#A67C52'
const INACTIVE = '#9C9686'

type Tab = { href: string; label: string; staffOnly?: boolean; icon: (active: boolean) => React.ReactNode }

const TABS: Tab[] = [
  {
    href: '/copsefield',
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/inspections/new',
    label: 'Inspect',
    staffOnly: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/tickets',
    label: 'Tickets',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/reports',
    label: 'Reports',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6M9 8h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/account',
    label: 'Account',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/choose',
    label: 'Switch',
    staffOnly: true,
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2">
        <path d="M7 16V4M7 4L3 8M7 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 8v12M17 20l4-4M17 20l-4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function CopsefieldBottomNav() {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('copsefield_role')
        .eq('id', user.id)
        .single()
      setIsOwner(profile?.copsefield_role === 'owner')
    })
  }, [])

  const tabs = TABS.filter((tab) => !isOwner || !tab.staffOnly)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-deck-border bg-deck-bg pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-2">
              {tab.icon(active)}
              <span className={`text-[10px] font-medium ${active ? 'text-copsefield-accent' : 'text-deck-dim'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
