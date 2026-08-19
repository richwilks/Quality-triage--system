'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBranding } from '@/components/BrandingContext'

const ITEMS = [
  {
    href: '/fmiq',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/fmiq/inspections/new',
    label: 'Inspect',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/fmiq/compliance',
    label: 'Compliance Tasks',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/fmiq/my-tasks',
    label: 'My Tasks',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
        <circle cx="4.5" cy="6" r="1.5" />
        <circle cx="4.5" cy="12" r="1.5" />
        <circle cx="4.5" cy="18" r="1.5" />
      </svg>
    ),
  },
  {
    href: '/fmiq/portfolio',
    label: 'Portfolio',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14l3-3 2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/fmiq/notifications',
    label: 'Notifications',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/choose',
    label: 'Switch System',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--fmiq-accent-color, #B45309)' : 'currentColor'} strokeWidth="2">
        <path d="M7 16V4M7 4L3 8M7 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 8v12M17 20l4-4M17 20l-4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function FMIQSidebar() {
  const pathname = usePathname()
  const branding = useBranding()

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-deck-border bg-deck-surface px-3 py-6 lg:flex print:hidden">
      <div className="flex items-center gap-2 px-2">
        <img
          src={branding.logoUrl || '/icon-192.png'}
          alt={branding.logoUrl ? branding.companyName || 'Company logo' : 'FMIQ'}
          className="h-8 w-8 rounded-md object-contain"
        />
        <span className="truncate text-sm font-bold text-deck-text">
          {branding.hideDefaultBrand && branding.companyName ? branding.companyName : 'FMIQ'}
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
                active ? 'bg-deck-raised text-fmiq-accent' : 'text-deck-body hover:bg-deck-raised'
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
