import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://inspectiq.co'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'InspectIQ — AI Construction Defect Management & Snagging Software',
  description:
    'AI-powered construction quality control: detect defects from a photo, cite the standard or spec clause it fails, route it to the right company, and build a Regulation 38 / Golden Thread audit trail automatically.',
  keywords: [
    'construction defect management software',
    'AI snagging software',
    'Regulation 38 software',
    'Golden Thread compliance software',
    'construction quality control software',
    'Building Safety Act software',
  ],
  alternates: { canonical: '/site' },
  openGraph: {
    title: 'InspectIQ — AI Construction Defect Management & Snagging Software',
    description:
      'Photograph a defect and InspectIQ tells you what it is, cites the clause it fails, and routes it to the right company - with a full audit trail for Golden Thread compliance.',
    type: 'website',
    siteName: 'InspectIQ',
    images: ['/icon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InspectIQ — AI Construction Defect Management & Snagging Software',
    description: 'AI-powered construction quality control, built for UK Regulation 38 and Golden Thread compliance.',
    images: ['/icon-512.png'],
  },
}

const MARKETING_SITE_PUBLIC = process.env.MARKETING_SITE_PUBLIC === 'true'

const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#compliance', label: 'Compliance' },
]

const BENTO = [
  {
    span: 'sm:col-span-2',
    stat: '3-in-1',
    title: 'One pass, every ground checked',
    body: 'Standard, project spec, and trade-quality judgement weighed together on every photo - not three separate reviews. Every finding cites the actual clause it fails.',
  },
  {
    span: '',
    stat: '100%',
    title: 'Approved before it closes',
    body: 'A fix only closes once the company that raised it signs off. Nothing gets marked done unseen.',
  },
  {
    span: '',
    stat: '±3m',
    title: 'Geo-tagged inspections',
    body: 'Walk the site and every photo is pinned to where it was taken, automatically.',
  },
  {
    span: 'sm:col-span-2',
    stat: 'Reg 38',
    title: 'Golden Thread, built in',
    body: 'A guided checklist tracks what has been handed over and what is still missing, with status reports and a handover pack generated on demand.',
  },
]

const STEPS = [
  { n: '01', title: 'Log it', body: 'Photo or short walkthrough video, straight from site.' },
  { n: '02', title: 'AI reviews it', body: 'Checked against spec and standards, drafted for approval.' },
  { n: '03', title: 'Route it', body: 'Assigned to the responsible company, notified instantly.' },
  { n: '04', title: 'Close it out', body: 'They fix it, you approve it. Every step on record.' },
]

const AUDIENCES = ['Main contractors', 'Developers & clients', 'Building inspectors', 'Supply chain partners']

export default function MarketingSitePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] font-sans text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'InspectIQ',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'AI-powered construction defect management and quality control software, with Regulation 38 and Golden Thread compliance tooling.',
            url: SITE_URL,
          }),
        }}
      />

      {!MARKETING_SITE_PUBLIC && (
        <div className="border-b border-white/10 bg-[#141416] px-4 py-2 text-center text-xs text-zinc-400">
          Private preview - only visible to signed-in accounts until this goes live.
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A0B]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight">InspectIQ</span>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden text-sm text-zinc-400 hover:text-white sm:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#2EE6A8] px-4 py-2 text-sm font-semibold text-[#0A0A0B] hover:bg-[#5CF0C2]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-20 pt-20 sm:pt-28">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(closest-side, #2EE6A8, transparent)' }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              AI-powered &middot; Built for UK construction
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
              Construction quality control, <span className="text-[#2EE6A8]">run by AI</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Photograph a defect and InspectIQ tells you what&apos;s wrong, cites the clause it fails, and routes
              it to the right company - building your Regulation 38 and Golden Thread audit trail as you go.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-full bg-[#2EE6A8] px-7 py-3 text-sm font-semibold text-[#0A0A0B] hover:bg-[#5CF0C2] sm:w-auto"
              >
                Get started free
              </Link>
              <a
                href="#how-it-works"
                className="w-full rounded-full border border-white/15 px-7 py-3 text-sm font-semibold text-white hover:bg-white/5 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Bento feature grid */}
        <section id="product" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BENTO.map((b) => (
              <div
                key={b.title}
                className={`${b.span} rounded-2xl border border-white/10 bg-[#141416] p-8`}
              >
                <p className="text-3xl font-bold text-[#2EE6A8]">{b.stat}</p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-white/10 bg-[#0D0D0F] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From photo to closed-out defect</h2>
            <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative">
                  <p className="text-4xl font-bold text-white/15">{s.n}</p>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                  {i < STEPS.length - 1 && (
                    <div className="mt-6 hidden h-px w-full bg-white/10 lg:block" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section id="compliance" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2EE6A8]">
                Building Safety Act era
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Regulation 38 and the Golden Thread, built in
              </h2>
              <p className="mt-5 text-base leading-relaxed text-zinc-400">
                Handing over accurate fire safety information is now a legal duty, not a box you tick at the
                end of a job. InspectIQ keeps the record building the whole way through, not assembled the
                week before completion - every assignment, approval, and closure timestamped and attributed.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#141416] p-8">
              <ul className="space-y-4 text-sm text-zinc-300">
                {[
                  'Guided checklist covering Reg 38 and Golden Thread requirements',
                  'Upload evidence directly against each checklist item',
                  'Generated status reports and a final handover pack',
                  'Your own report template, or a standard one out of the box',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2EE6A8]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-y border-white/10 bg-[#0D0D0F] py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 text-sm text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Built for</span>
            {AUDIENCES.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">See it on your own project.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Set up a project, take a photo, and see what InspectIQ finds.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-full bg-[#2EE6A8] px-8 py-3 text-sm font-semibold text-[#0A0A0B] hover:bg-[#5CF0C2]"
          >
            Get started free
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-zinc-500 sm:flex-row">
          <p>InspectIQ</p>
          <p>&copy; {new Date().getFullYear()} InspectIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
