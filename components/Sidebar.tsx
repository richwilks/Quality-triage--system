'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBranding } from '@/components/BrandingContext'

const ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/new-defect',
    label: 'New Defect',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/review',
    label: 'Review',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/notifications',
    label: 'Alerts',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/reg38',
    label: 'Regulation 38',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M9 2h6l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/golden-thread',
    label: 'Golden Thread',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M4 18c0-3 2.5-3 5-3s5 0 5-3-2.5-3-5-3 5 0 5-3 2.5-3 5-3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 3.2" />
        <circle cx="19" cy="6" r="2" />
      </svg>
    ),
  },
  {
    href: '/dashboard/dva',
    label: 'DVA',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <path d="M4 20V10M4 10l4-4M4 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 4v10M20 14l-4-4M20 14l-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 4h4M10 20h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/account',
    label: 'Account',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : 'currentColor'} strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const branding = useBranding()

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-deck-border bg-deck-surface px-3 py-6 lg:flex print:hidden">
      <div className="flex items-center gap-2 px-2">
        <img
          src={branding.logoUrl || '/icon-192.png'}
          alt={branding.logoUrl ? branding.companyName || 'Company logo' : 'InspectIQ'}
          className="h-8 w-8 rounded-md object-contain"
        />
        <span className="truncate text-sm font-bold text-deck-text">
          {branding.hideDefaultBrand && branding.companyName ? branding.companyName : 'InspectIQ'}
        </span>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                active ? 'bg-deck-raised text-deck-accent' : 'text-deck-body hover:bg-deck-raised'
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
