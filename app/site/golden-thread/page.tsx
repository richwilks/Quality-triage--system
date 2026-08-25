import Link from 'next/link'
import type { Metadata } from 'next'
import { GOLDEN_THREAD_ITEMS } from '@/lib/reg38Checklist'

const SITE_URL = 'https://inspectiq.co'
const CREAM = '#FBF6EE'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Golden Thread Compliance Software — Building Safety Act | InspectIQ',
  description:
    'Golden Thread compliance software for Higher-Risk Buildings under the Building Safety Act 2022: keep design, construction, and safety records accurate and accessible from Gateway 2 through occupation.',
  keywords: ['Golden Thread compliance software', 'Building Safety Act software', 'Higher-Risk Building record keeping', 'Gateway 2 Gateway 3 software'],
  alternates: { canonical: '/site/golden-thread' },
  openGraph: {
    title: 'Golden Thread Compliance Software — Building Safety Act | InspectIQ',
    description:
      'Keep the Golden Thread of building safety information accurate and accessible, built up throughout the project rather than assembled after the fact.',
    type: 'website',
    siteName: 'InspectIQ',
    images: ['/icon-512.png'],
  },
}

function ThreadIllustration() {
  return (
    <svg viewBox="0 0 400 150" className="h-auto w-full" fill="none">
      <path
        d="M50 110c0-40 30-40 60-40s60 0 60-40 30-40 60-40 60 0 60 40"
        stroke={CREAM}
        strokeWidth="2.5"
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      {[
        [50, 110],
        [140, 30],
        [230, 30],
        [290, 30],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill={i === 3 ? '#4A473F' : 'none'} stroke={CREAM} strokeWidth="2" />
      ))}
      <rect x="330" y="55" width="45" height="60" stroke={CREAM} strokeWidth="2" />
      <line x1="338" y1="70" x2="367" y2="70" stroke={CREAM} strokeWidth="1.25" />
      <line x1="338" y1="82" x2="367" y2="82" stroke={CREAM} strokeWidth="1.25" />
      <line x1="338" y1="94" x2="360" y2="94" stroke={CREAM} strokeWidth="1.25" />
    </svg>
  )
}

export default function GoldenThreadPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] font-sans text-[#24221D] antialiased">
      <header className="sticky top-0 z-20 border-b border-[#DCD8CE] bg-[#F5F3EE]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/site" className="text-base font-bold tracking-tight text-[#24221D]">
            InspectIQ
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#4A473F] md:flex">
            <Link href="/site#product" className="hover:text-[#24221D]">Product</Link>
            <Link href="/site/regulation-38" className="hover:text-[#24221D]">Regulation 38</Link>
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
          The Golden Thread, built as you go
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#4A473F]">
          The Building Safety Act 2022 requires the Accountable Person for an occupied, registered Higher-Risk
          Building to keep accurate design, construction, and safety records - accessible and up to date, not
          reconstructed after the fact. InspectIQ keeps that record building throughout the project, and shows
          it plainly on every project even where it isn&apos;t yet a legal requirement, as good practice.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl bg-[#5E8299] p-8 sm:p-12">
          <ThreadIllustration />
        </div>

        <p className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          This reflects our best understanding of the Golden Thread requirements under the Building Safety Act
          2022 and the Higher-Risk Buildings (Keeping and Provision of Information etc.) (England) Regulations
          2024 - it isn&apos;t a substitute for legal advice. Have your Principal Accountable Person or building
          safety professional confirm what&apos;s required for a specific building.
        </p>

        <h2 className="mt-14 text-2xl font-bold tracking-tight text-[#24221D]">What the Golden Thread covers</h2>
        <div className="mt-6 space-y-6">
          {GOLDEN_THREAD_ITEMS.map((item) => (
            <div key={item.key} className="border-t border-[#DCD8CE] pt-5">
              <h3 className="text-base font-semibold text-[#24221D]">{item.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#767162]">{item.guidance}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-2xl font-bold tracking-tight text-[#24221D]">How InspectIQ helps</h2>
        <ul className="mt-6 space-y-4 text-sm text-[#4A473F]">
          {[
            'A toggle marks a project as a Higher-Risk Building, so the checklist labels each item legally required or recommended accordingly',
            'Every item tracked live, with evidence uploaded directly against it',
            'Generated status reports and a final handover pack on demand',
            'Sits alongside Regulation 38 tracking, on the same record',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2A6F77]" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-14 rounded-xl border border-[#DCD8CE] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#24221D]">Keep your Golden Thread accurate from Gateway 2</p>
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
