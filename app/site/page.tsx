import Link from 'next/link'
import { Fraunces } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})

export const metadata = {
  title: 'InspectIQ — AI-powered construction quality control',
  description:
    'Photograph a defect and InspectIQ tells you what it is, whether it fails your spec or a standard, and routes it to the right company - with a full audit trail for Golden Thread compliance.',
}

const MARKETING_SITE_PUBLIC = process.env.MARKETING_SITE_PUBLIC === 'true'

const CHAPTERS = [
  {
    n: '01',
    label: 'Detection',
    title: 'Every photo, verified',
    body: 'Photograph or walk-video a defect. The AI identifies the element, checks it against your project spec, the applicable standard, and plain trade-quality judgement, all in one pass, and drafts the write-up for you to approve. Every finding cites the actual clause it fails, not a generic guess.',
    Illustration: DetectionIllustration,
  },
  {
    n: '02',
    label: 'Workflow',
    title: 'Routed, not lost',
    body: 'Route a defect to the responsible company in one step and everyone there is notified immediately. When they mark it fixed, it waits for your sign-off before it can close, so nothing gets marked done without you seeing it.',
    Illustration: RoutingIllustration,
  },
  {
    n: '03',
    label: 'Site record',
    title: 'The whole picture',
    body: 'Start an inspection and InspectIQ tracks the route you walked and geo-tags every photo against it. Live dashboards roll everything up by status, by project, and by company, so a backlog shows up before it becomes a problem on handover day.',
    Illustration: PathIllustration,
  },
]

const SPEC_ROWS = [
  { label: '01', value: 'Log it', detail: 'Take a photo or a short walkthrough video on site.' },
  { label: '02', value: 'AI reviews it', detail: 'Classified, checked against spec and standards, drafted for your approval.' },
  { label: '03', value: 'Route it', detail: 'Assigned to the responsible company, who are notified straight away.' },
  { label: '04', value: 'Close it out', detail: 'They mark it fixed, you approve the close-out. Every step on record.' },
]

const GOLDEN_THREAD_ITEMS = [
  'Guided checklist covering Reg 38 and Golden Thread requirements',
  'Upload evidence directly against each checklist item',
  'Generated status reports and a final handover pack',
  'Your own report template, or a standard one out of the box',
]

// Original line-art illustrations, in the same monochrome/blueprint hand
// rather than photography or stock icons - ink-on-paper strokes, no fill,
// each one a small diagram of what that section is actually describing.
const INK = '#111111'
const INK_DIM = '#A6A296'

function HeroIllustration() {
  return (
    <svg viewBox="0 0 600 230" className="h-auto w-full" fill="none">
      <rect x="1" y="1" width="598" height="228" stroke={INK_DIM} strokeWidth="1" />
      <rect x="230" y="60" width="150" height="110" stroke={INK} strokeWidth="1.5" strokeDasharray="5 4" />
      <circle cx="230" cy="60" r="11" stroke={INK} strokeWidth="1.5" />
      <text x="230" y="64" textAnchor="middle" fontSize="11" fill={INK} fontFamily="sans-serif">1</text>
      <line x1="380" y1="90" x2="470" y2="70" stroke={INK} strokeWidth="1" />
      <circle cx="470" cy="70" r="2" fill={INK} />
      <text x="478" y="74" fontSize="12" fill={INK} fontFamily="sans-serif">BS 8204&#8211;1, 10.3</text>
      <line x1="290" y1="170" x2="330" y2="196" stroke={INK} strokeWidth="1" />
      <circle cx="330" cy="196" r="2" fill={INK} />
      <text x="338" y="200" fontSize="12" fill={INK} fontFamily="sans-serif">Assigned &#8211; Acme Ltd</text>
    </svg>
  )
}

function DetectionIllustration() {
  return (
    <svg viewBox="0 0 600 150" className="h-auto w-full" fill="none">
      <circle cx="150" cy="75" r="46" stroke={INK} strokeWidth="1.25" strokeDasharray="3 3" />
      <text x="150" y="66" textAnchor="middle" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">standard</text>
      <circle cx="230" cy="75" r="46" stroke={INK} strokeWidth="1.25" strokeDasharray="3 3" />
      <text x="230" y="66" textAnchor="middle" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">spec</text>
      <circle cx="190" cy="105" r="46" stroke={INK} strokeWidth="1.25" strokeDasharray="3 3" />
      <text x="190" y="140" textAnchor="middle" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">workmanship</text>
      <circle cx="190" cy="88" r="3" fill={INK} />
      <line x1="260" y1="88" x2="330" y2="88" stroke={INK} strokeWidth="1" />
      <path d="M323 82 L330 88 L323 94" stroke={INK} strokeWidth="1.25" fill="none" />
      <rect x="345" y="52" width="150" height="72" stroke={INK} strokeWidth="1.25" />
      <text x="365" y="78" fontSize="12" fill={INK} fontFamily="sans-serif">Snag / NCR</text>
      <text x="365" y="96" fontSize="12" fill={INK} fontFamily="sans-serif">Cited clause</text>
      <text x="365" y="114" fontSize="12" fill={INK} fontFamily="sans-serif">Confidence</text>
    </svg>
  )
}

function RoutingIllustration() {
  return (
    <svg viewBox="0 0 600 130" className="h-auto w-full" fill="none">
      <rect x="30" y="45" width="110" height="40" stroke={INK} strokeWidth="1.25" />
      <text x="85" y="69" textAnchor="middle" fontSize="12" fill={INK} fontFamily="sans-serif">Defect raised</text>
      <line x1="140" y1="65" x2="230" y2="65" stroke={INK} strokeWidth="1" />
      <path d="M223 59 L230 65 L223 71" stroke={INK} strokeWidth="1.25" fill="none" />
      <circle cx="290" cy="65" r="40" stroke={INK} strokeWidth="1.25" strokeDasharray="3 3" />
      <text x="290" y="61" textAnchor="middle" fontSize="12" fill={INK} fontFamily="sans-serif">Company</text>
      <text x="290" y="76" textAnchor="middle" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">notified</text>
      <line x1="330" y1="65" x2="420" y2="65" stroke={INK} strokeWidth="1" />
      <path d="M413 59 L420 65 L413 71" stroke={INK} strokeWidth="1.25" fill="none" />
      <rect x="430" y="45" width="140" height="40" stroke={INK} strokeWidth="1.25" />
      <text x="500" y="63" textAnchor="middle" fontSize="12" fill={INK} fontFamily="sans-serif">Approved &amp;</text>
      <text x="500" y="78" textAnchor="middle" fontSize="12" fill={INK} fontFamily="sans-serif">closed</text>
    </svg>
  )
}

function PathIllustration() {
  const points = [
    [40, 100],
    [90, 60],
    [150, 80],
    [210, 40],
    [270, 55],
    [330, 30],
    [400, 45],
  ]
  return (
    <svg viewBox="0 0 600 140" className="h-auto w-full" fill="none">
      <polyline points={points.map((p) => p.join(',')).join(' ')} stroke={INK} strokeWidth="1.25" strokeDasharray="2 5" strokeLinecap="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 || i === points.length - 1 ? 4 : 2.5} fill={i === 0 || i === points.length - 1 ? 'white' : INK} stroke={INK} strokeWidth="1.25" />
      ))}
      <rect x="460" y="20" width="120" height="95" stroke={INK} strokeWidth="1.25" />
      <text x="475" y="42" fontSize="12" fill={INK} fontFamily="sans-serif">Level 2</text>
      <line x1="475" y1="52" x2="565" y2="52" stroke={INK_DIM} strokeWidth="1" />
      <text x="475" y="68" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">14 points</text>
      <text x="475" y="84" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">&#177;6m accuracy</text>
      <text x="475" y="100" fontSize="11" fill={INK_DIM} fontFamily="sans-serif">2 photos pinned</text>
    </svg>
  )
}

export default function MarketingSitePage() {
  return (
    <div className={`${fraunces.variable} min-h-screen bg-[#FBFAF8] text-[#111111]`}>
      {!MARKETING_SITE_PUBLIC && (
        <div className="border-b border-[#E4E1DA] bg-[#F3F1EB] px-4 py-2 text-center text-xs text-[#6B6862]">
          Private preview - only visible to signed-in accounts until this goes live.
        </div>
      )}

      <header className="mx-auto flex max-w-6xl items-start justify-between px-6 py-8">
        <div className="text-sm leading-tight text-[#111111]">
          <p>InspectIQ</p>
          <p>Construction Quality</p>
          <p>Platform</p>
        </div>
        <nav className="flex items-center gap-1 text-sm text-[#111111]">
          <a href="#product" className="px-1 hover:opacity-60">Product,</a>
          <a href="#compliance" className="px-1 hover:opacity-60">Compliance,</a>
          <Link href="/login" className="px-1 hover:opacity-60">Log in</Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-8">
          <h1
            style={{ fontFamily: 'var(--font-serif)' }}
            className="max-w-3xl text-[2.75rem] font-normal leading-[1.05] sm:text-6xl"
          >
            Precision on site
          </h1>

          <div className="mt-10 max-w-2xl">
            <HeroIllustration />
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-[#111111] pt-8 sm:grid-cols-2">
            <p style={{ fontFamily: 'var(--font-serif)' }} className="text-xl leading-relaxed text-[#111111] sm:text-2xl">
              InspectIQ turns a site photo into a defect record that cites your own spec, routes to the
              right company, and stays on the record until it&apos;s actually closed out.
            </p>
            <div className="flex flex-col items-start justify-between gap-6 sm:items-end">
              <p className="text-sm leading-relaxed text-[#6B6862]">
                Built around what UK construction quality teams need for day-to-day snagging and for
                Regulation 38 / Golden Thread handover.
              </p>
              <Link href="/signup" className="border-b border-[#111111] pb-0.5 text-sm text-[#111111] hover:opacity-60">
                Get started &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* Problem statement, italic serif, editorial */}
        <section className="border-y border-[#E4E1DA] bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            <p
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-2xl italic leading-relaxed text-[#111111] sm:text-3xl"
            >
              Snagging still runs on spreadsheets, group chats, and memory. A defect gets photographed,
              chased up by phone, and closed out on trust - by handover, nobody can say for certain where
              it was taken or who signed off on it.
            </p>
          </div>
        </section>

        {/* Chapters */}
        <section id="product" className="mx-auto max-w-5xl px-6 py-8">
          {CHAPTERS.map((c) => (
            <div key={c.n} className="border-t border-[#E4E1DA] py-14 first:border-t-0">
              <p className="text-sm text-[#6B6862]">{c.n} &mdash; {c.label}</p>
              <h2
                style={{ fontFamily: 'var(--font-serif)' }}
                className="mt-3 text-3xl leading-tight text-[#111111] sm:text-4xl"
              >
                {c.title}
              </h2>
              <div className="mt-8 max-w-2xl">
                <c.Illustration />
              </div>
              <p style={{ fontFamily: 'var(--font-serif)' }} className="mt-8 max-w-2xl text-lg leading-relaxed text-[#111111]">
                {c.body}
              </p>
            </div>
          ))}
        </section>

        {/* Full-bleed dark cover, CSS blueprint texture instead of a photo */}
        <section
          className="relative flex min-h-[420px] items-end overflow-hidden bg-[#111111] px-6 py-16 text-white sm:min-h-[520px]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        >
          <div className="mx-auto w-full max-w-5xl">
            <p style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl leading-tight sm:text-5xl">
              An accurate record, from the first photo to final handover.
            </p>
          </div>
        </section>

        {/* How it works, spec-sheet style */}
        <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm text-[#6B6862]">How it works</p>
          <div className="mt-6">
            {SPEC_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[3rem_1fr] gap-6 border-t border-[#E4E1DA] py-6 sm:grid-cols-[3rem_12rem_1fr]"
              >
                <p className="text-sm text-[#6B6862]">{row.label}</p>
                <p style={{ fontFamily: 'var(--font-serif)' }} className="text-lg text-[#111111]">{row.value}</p>
                <p className="text-sm leading-relaxed text-[#6B6862] sm:text-base">{row.detail}</p>
              </div>
            ))}
            <div className="border-t border-[#E4E1DA]" />
          </div>
        </section>

        {/* Compliance */}
        <section id="compliance" className="border-t border-[#E4E1DA] bg-white py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm text-[#6B6862]">Building Safety Act era</p>
              <h2 style={{ fontFamily: 'var(--font-serif)' }} className="mt-3 text-3xl leading-tight text-[#111111] sm:text-4xl">
                Regulation 38 and the Golden Thread, built in
              </h2>
              <p style={{ fontFamily: 'var(--font-serif)' }} className="mt-5 text-lg leading-relaxed text-[#111111]">
                Handing over accurate fire safety information is now a legal duty, not a box you tick at
                the end of a job. The record has been building the whole way through, not assembled the
                week before completion.
              </p>
            </div>
            <div>
              <ul className="space-y-4">
                {GOLDEN_THREAD_ITEMS.map((item) => (
                  <li key={item} className="border-t border-[#E4E1DA] pt-4 text-sm leading-relaxed text-[#111111]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <p style={{ fontFamily: 'var(--font-serif)' }} className="text-3xl leading-tight text-[#111111] sm:text-4xl">
            See it on your own project.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block border border-[#111111] px-8 py-3 text-sm text-[#111111] hover:bg-[#111111] hover:text-white"
          >
            Get started
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#E4E1DA] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-[#6B6862] sm:flex-row">
          <p>InspectIQ</p>
          <p>&copy; {new Date().getFullYear()} InspectIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
