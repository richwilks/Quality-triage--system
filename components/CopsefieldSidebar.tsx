'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ICON_STROKE = 'currentColor'
const ACTIVE_STROKE = '#A67C52'

type NavItem = {
  href: string
  label: string
  staffOnly?: boolean
  icon: (active: boolean) => React.ReactNode
}

const ITEMS: NavItem[] = [
  {
    href: '/copsefield',
    label: 'Home',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/buildings',
    label: 'Buildings',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/inspections/new',
    label: 'New Inspection',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/tickets',
    label: 'Tickets',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/work-orders',
    label: 'Work Orders',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 015.4-5.4l-2.3 2.3-2-2 2.3-2.3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/my-tasks',
    label: 'My Tasks',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
        <circle cx="4.5" cy="6" r="1.5" />
        <circle cx="4.5" cy="12" r="1.5" />
        <circle cx="4.5" cy="18" r="1.5" />
      </svg>
    ),
  },
  {
    href: '/copsefield/dashboard',
    label: 'Dashboard',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/economic-reports',
    label: 'Economic Reports',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 16l2.5-4 2.5 2 3-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/reports',
    label: 'Reports',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6M9 8h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/account',
    label: 'Account',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/copsefield/settings',
    label: 'Settings',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/choose',
    label: 'Switch System',
    staffOnly: true,
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE_STROKE : ICON_STROKE} strokeWidth="2">
        <path d="M7 16V4M7 4L3 8M7 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 8v12M17 20l4-4M17 20l-4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function CopsefieldSidebar() {
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

  const items = ITEMS.filter((item) => !isOwner || !item.staffOnly)

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-deck-border bg-deck-surface px-3 py-6 lg:flex print:hidden">
      <div className="flex items-center gap-2 px-2">
        <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-8 w-8 rounded-md object-contain" />
        <span className="truncate text-sm font-bold text-deck-text">Copsefield Group</span>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                active ? 'bg-deck-raised text-copsefield-accent' : 'text-deck-body hover:bg-deck-raised'
              }`}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
