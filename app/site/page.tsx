import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'InspectIQ — AI-powered construction quality control',
  description:
    'Photograph a defect and InspectIQ tells you what it is, whether it fails your spec or a standard, and routes it to the right company - with a full audit trail for Golden Thread compliance.',
}

const MARKETING_SITE_PUBLIC = process.env.MARKETING_SITE_PUBLIC === 'true'

const FEATURES = [
  {
    title: 'Point, shoot, done',
    body: 'Photograph or walk-video a defect. The AI identifies the element, checks it against your project spec, the applicable standard, and plain trade-quality judgement - all in one pass - and drafts the write-up for you to approve.',
  },
  {
    title: 'Grounded in your own documents',
    body: "Upload your project spec and referenced standards once. Every finding cites the actual clause it's failing, not a generic guess - and the AI recalibrates to what's actually acceptable for the finish grade you specified.",
  },
  {
    title: 'Assign it, and it gets there',
    body: 'Route a defect to the responsible company in one step. Everyone there is notified immediately. When they mark it fixed, it waits for your sign-off before it can close - so nothing gets marked done without you seeing it.',
  },
  {
    title: 'Built for the Golden Thread',
    body: "A guided Regulation 38 and Golden Thread checklist tracks what's been handed over and what's still missing, with generated status reports and a final handover pack - because getting this right is now a legal requirement, not paperwork you get to later.",
  },
  {
    title: 'Know where every photo was taken',
    body: "Start an inspection and InspectIQ tracks the route you walked and geo-tags every photo against it - so 'where on site was this' is never a question you have to answer from memory.",
  },
  {
    title: 'See the whole picture',
    body: 'Live dashboards roll defects up by status, by project, and by company - so a backlog you should be worried about shows up before it becomes a problem on handover day, not after.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Log it',
    body: 'Take a photo or a short walkthrough video on site. No forms to fill in first.',
  },
  {
    n: '02',
    title: 'AI reviews it',
    body: 'Classified as a snag or non-conformance, checked against your spec and standards, and drafted for you to confirm or edit.',
  },
  {
    n: '03',
    title: 'Route it',
    body: 'Assign it to the company responsible. They’re notified straight away with a target date.',
  },
  {
    n: '04',
    title: 'Close it out, properly',
    body: 'They mark it fixed, you approve the close-out. Every step is on record for handover.',
  },
]

export default function MarketingSitePage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink">
      {!MARKETING_SITE_PUBLIC && (
        <div className="bg-brand-ink px-4 py-2 text-center text-xs font-medium text-white/80">
          Private preview - only visible to signed-in accounts until this goes live.
        </div>
      )}

      <header className="border-b border-slate-200/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/icon-192.png" alt="InspectIQ" width={32} height={32} className="rounded-md" />
            <span className="text-lg font-bold">InspectIQ</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#product" className="hover:text-brand-ink">Product</a>
            <a href="#how-it-works" className="hover:text-brand-ink">How it works</a>
            <a href="#compliance" className="hover:text-brand-ink">Compliance</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-brand-ink">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">
            AI-powered construction quality control
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Every defect, spotted, cited, and chased down - without the paper trail chasing you
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            InspectIQ turns a site photo into a defect record that cites your spec, routes to the right
            company, and stays on the record until it's actually closed out - built around what UK
            construction quality teams actually need for Regulation 38 and the Golden Thread.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-md bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
            >
              Get started
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-brand-ink hover:bg-slate-50 sm:w-auto"
            >
              See how it works
            </a>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm sm:grid-cols-3 sm:p-8">
            <div>
              <p className="text-2xl font-bold text-brand-primary">Snag or NCR</p>
              <p className="mt-1 text-sm text-slate-600">Classified automatically, with the reasoning shown</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">Clause-cited</p>
              <p className="mt-1 text-sm text-slate-600">Findings reference your actual spec and standards</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">Fully tracked</p>
              <p className="mt-1 text-sm text-slate-600">Assigned, approved, and logged for handover</p>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-slate-200/70 bg-white py-16">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Snagging still runs on spreadsheets, group chats, and memory
            </h2>
            <p className="mt-4 text-slate-600">
              A defect gets photographed, described from scratch, chased up by phone, and closed out on
              trust. By the time it reaches a handover pack, nobody can say for certain where it was taken,
              whether it was actually fixed, or who signed off on it. InspectIQ replaces that with a record
              that's accurate from the moment the photo's taken.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="product" className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Everything a site inspection needs, in one place</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Not a generic checklist app - built around how a photo actually turns into a closed-out
              defect on a UK construction site.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="font-semibold text-brand-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-slate-200/70 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">From photo to closed-out defect</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <p className="text-3xl font-bold text-brand-primary/40">{s.n}</p>
                  <h3 className="mt-2 font-semibold text-brand-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section id="compliance" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">
                Building Safety Act era
              </p>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                Regulation 38 and the Golden Thread, built in - not bolted on
              </h2>
              <p className="mt-4 text-slate-600">
                Handing over accurate fire safety information is now a legal duty, not a box you tick at
                the end of a job. InspectIQ keeps a guided checklist of what's required, prompts your team
                on what's missing, and generates the status reports and handover pack when you need them -
                so the record has been building the whole way through, not assembled the week before
                completion.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Every defect assignment, approval, and closure is timestamped and attributed - the audit
                trail regulators and building owners are increasingly going to expect.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <ul className="space-y-3 text-sm text-slate-700">
                {[
                  'Guided checklist covering both Reg 38 and Golden Thread requirements',
                  'Upload evidence directly against each checklist item',
                  'Generated status reports and a final handover pack',
                  'Your own report template, or a standard one out of the box',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-ink py-16 text-center text-white">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-bold sm:text-3xl">See it on your own project</h2>
            <p className="mt-3 text-white/70">
              Set up a project, take a photo, and see what InspectIQ finds.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-md bg-white px-6 py-3 text-sm font-semibold text-brand-ink hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/icon-192.png" alt="InspectIQ" width={20} height={20} className="rounded" />
            <span className="font-medium text-slate-600">InspectIQ</span>
          </div>
          <p>&copy; {new Date().getFullYear()} InspectIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
