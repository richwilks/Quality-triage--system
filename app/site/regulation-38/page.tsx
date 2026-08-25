import Link from 'next/link'
import type { Metadata } from 'next'
import { REG38_ITEMS } from '@/lib/reg38Checklist'

const SITE_URL = 'https://inspectiq.co'
const CREAM = '#FBF6EE'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Regulation 38 Software — Fire Safety Information Handover | InspectIQ',
  description:
    'Guided Regulation 38 compliance software for UK construction: track the fire safety information handover pack as you build, upload evidence against each item, and generate the final pack for the Responsible Person.',
  keywords: ['Regulation 38 software', 'Reg 38 fire safety handover', 'fire safety information pack software', 'Building Regulations 2010 compliance software'],
  alternates: { canonical: '/site/regulation-38' },
  openGraph: {
    title: 'Regulation 38 Software — Fire Safety Information Handover | InspectIQ',
    description:
      'Track the Regulation 38 fire safety information handover pack as you build, not the week before completion.',
    type: 'website',
    siteName: 'InspectIQ',
    images: ['/icon-512.png'],
  },
}

function DocIllustration() {
  return (
    <svg viewBox="0 0 400 150" className="h-auto w-full" fill="none">
      <rect x="120" y="20" width="90" height="110" stroke={CREAM} strokeWidth="2" />
      <line x1="136" y1="44" x2="194" y2="44" stroke={CREAM} strokeWidth="1.5" />
      <line x1="136" y1="60" x2="194" y2="60" stroke={CREAM} strokeWidth="1.5" />
      <line x1="136" y1="76" x2="180" y2="76" stroke={CREAM} strokeWidth="1.5" />
      <path d="M136 100l10 10 20-22" stroke={CREAM} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M255 75c0-14 10-24 22-24s22 10 22 24c0 18-22 38-22 38s-22-20-22-38z"
        stroke={CREAM}
        strokeWidth="2"
      />
      <circle cx="277" cy="72" r="7" stroke={CREAM} strokeWidth="1.5" />
    </svg>
  )
}

export default function Regulation38Page() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] font-sans text-[#24221D] antialiased">
      <header className="sticky top-0 z-20 border-b border-[#DCD8CE] bg-[#F5F3EE]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/site" className="text-base font-bold tracking-tight text-[#24221D]">
            InspectIQ
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#4A473F] md:flex">
            <Link href="/site#product" className="hover:text-[#24221D]">Product</Link>
            <Link href="/site/golden-thread" className="hover:text-[#24221D]">Golden Thread</Link>
          </nav>
          <Link
            href="/signup"
            className="rounded-md bg-[#2A6F77] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F565C]"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/site" className="text-sm text-[#767162] hover:text-[#24221D]">&larr; InspectIQ</Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#24221D] sm:text-5xl">
          Regulation 38 fire safety handover
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#4A473F]">
          Whoever carries out the building work has to hand the Responsible Person a package of fire safety
          information, no later than completion or occupation - so they can operate, maintain, and risk-assess
          the building going forward. InspectIQ tracks that pack against a guided checklist from day one,
          instead of it being assembled in a rush the week before handover.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl bg-[#C97A4A] p-8 sm:p-12">
          <DocIllustration />
        </div>

        <p className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          This reflects our best understanding of Regulation 38 (Building Regulations 2010) - it isn&apos;t a
          substitute for legal or fire-safety advice. Have your Principal Accountable Person, fire engineer, or
          building safety professional confirm what&apos;s required for a specific building.
        </p>

        <h2 className="mt-14 text-2xl font-bold tracking-tight text-[#24221D]">What the handover pack covers</h2>
        <div className="mt-6 space-y-6">
          {REG38_ITEMS.map((item) => (
            <div key={item.key} className="border-t border-[#DCD8CE] pt-5">
              <h3 className="text-base font-semibold text-[#24221D]">{item.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#767162]">{item.guidance}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-2xl font-bold tracking-tight text-[#24221D]">How InspectIQ helps</h2>
        <ul className="mt-6 space-y-4 text-sm text-[#4A473F]">
          {[
            'Every item on this checklist tracked live against your project, with a status of missing, uploaded, or approved',
            'Upload evidence directly against each item, prompted on what’s still outstanding',
            'A generated status report at any point, and a final handover pack when you’re ready',
            'Sits alongside Golden Thread tracking for Higher-Risk Buildings, on the same record',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2A6F77]" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-14 rounded-xl border border-[#DCD8CE] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#24221D]">Track your Regulation 38 pack from day one</p>
          <Link
            href="/signup"
            className="mt-5 inline-block rounded-md bg-[#2A6F77] px-7 py-3 text-sm font-semibold text-white hover:bg-[#1F565C]"
          >
            Get started free
          </Link>
        </div>
      </main>

      <footer className="border-t border-[#DCD8CE] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-[#9C9686] sm:flex-row">
          <p>InspectIQ</p>
          <p>&copy; {new Date().getFullYear()} InspectIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
