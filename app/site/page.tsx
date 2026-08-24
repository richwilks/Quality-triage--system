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
    <div className="min-h-screen bg-[#F5F3EE] font-sans text-[#24221D] antialiased">
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
        <div className="border-b border-[#DCD8CE] bg-[#ECE9E1] px-4 py-2 text-center text-xs text-[#767162]">
          Private preview - only visible to signed-in accounts until this goes live.
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#DCD8CE] bg-[#F5F3EE]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight text-[#24221D]">InspectIQ</span>
          <nav className="hidden items-center gap-8 text-sm text-[#4A473F] md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[#24221D]">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden text-sm text-[#4A473F] hover:text-[#24221D] sm:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-[#2A6F77] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F565C]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-6 pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-md bg-[#ECE9E1] px-3 py-1 text-xs text-[#767162]">
              AI-powered &middot; Built for UK construction
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-[#24221D] sm:text-6xl">
              Construction quality control, run by AI
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4A473F]">
              Photograph a defect and InspectIQ tells you what&apos;s wrong, cites the clause it fails, and routes
              it to the right company - building your Regulation 38 and Golden Thread audit trail as you go.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-md bg-[#2A6F77] px-7 py-3 text-sm font-semibold text-white hover:bg-[#1F565C] sm:w-auto"
              >
                Get started free
              </Link>
              <a
                href="#how-it-works"
                className="w-full rounded-md border border-[#DCD8CE] px-7 py-3 text-sm font-semibold text-[#24221D] hover:bg-[#ECE9E1] sm:w-auto"
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
                className={`${b.span} rounded-xl border border-[#DCD8CE] bg-white p-8 shadow-sm`}
              >
                <p className="text-2xl font-bold text-[#24221D]">{b.stat}</p>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-[#24221D]">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#767162]">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-[#DCD8CE] bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold tracking-tight text-[#24221D] sm:text-4xl">
              From photo to closed-out defect
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="border-t border-[#DCD8CE] pt-5">
                  <p className="text-sm font-semibold text-[#9C9686]">{s.n}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#24221D]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#767162]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section id="compliance" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9C9686]">
                Building Safety Act era
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#24221D] sm:text-4xl">
                Regulation 38 and the Golden Thread, built in
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#4A473F]">
                Handing over accurate fire safety information is now a legal duty, not a box you tick at the
                end of a job. InspectIQ keeps the record building the whole way through, not assembled the
                week before completion - every assignment, approval, and closure timestamped and attributed.
              </p>
            </div>
            <div className="rounded-xl border border-[#DCD8CE] bg-white p-8 shadow-sm">
              <ul className="space-y-4 text-sm text-[#4A473F]">
                {[
                  'Guided checklist covering Reg 38 and Golden Thread requirements',
                  'Upload evidence directly against each checklist item',
                  'Generated status reports and a final handover pack',
                  'Your own report template, or a standard one out of the box',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2A6F77]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-y border-[#DCD8CE] bg-white py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 text-sm text-[#4A473F]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9C9686]">Built for</span>
            {AUDIENCES.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#24221D] sm:text-5xl">
            See it on your own project.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#4A473F]">
            Set up a project, take a photo, and see what InspectIQ finds.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-md bg-[#2A6F77] px-8 py-3 text-sm font-semibold text-white hover:bg-[#1F565C]"
          >
            Get started free
          </Link>
        </section>
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
