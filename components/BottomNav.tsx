'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { QUICK_LINKS } from '@/lib/quickLinks'

const TABS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : '#9C9686'} strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/new-defect',
    label: 'New',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : '#9C9686'} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/review',
    label: 'Review',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : '#9C9686'} strokeWidth="2">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/notifications',
    label: 'Alerts',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : '#9C9686'} strokeWidth="2">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/account',
    label: 'Account',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--deck-accent-color, #2A6F77)' : '#9C9686'} strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [quickAccessOpen, setQuickAccessOpen] = useState(false)

  return (
    <>
      {quickAccessOpen && (
        <div
          onClick={() => setQuickAccessOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden print:hidden"
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-deck-border bg-deck-bg pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        <div className="mx-auto max-w-md">
          <div
            className="overflow-hidden transition-[max-height] duration-300 ease-out"
            style={{ maxHeight: quickAccessOpen ? '60vh' : '0px' }}
          >
            <div className="max-h-[60vh] overflow-y-auto border-b border-deck-border">
              {QUICK_LINKS.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setQuickAccessOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 text-[13.5px] font-medium ${
                    link.primary ? 'bg-deck-raised text-deck-accent' : 'bg-deck-surface text-deck-text'
                  } ${i < QUICK_LINKS.length - 1 ? 'border-b border-deck-border' : ''}`}
                >
                  <span>{link.label}</span>
                  <span className="font-mono text-deck-mute">→</span>
                </Link>
              ))}
            </div>
          </div>

          <button
            onClick={() => setQuickAccessOpen((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1.5 border-b border-deck-border py-1.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-wide text-deck-mute">Quick Access</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`text-deck-mute transition-transform ${quickAccessOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex items-stretch justify-between px-2">
            {TABS.map((tab) => {
              const active = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setQuickAccessOpen(false)}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2"
                >
                  {tab.icon(active)}
                  <span
                    className={`text-[10px] font-medium ${active ? 'text-deck-accent' : 'text-deck-dim'}`}
                  >
                    {tab.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
