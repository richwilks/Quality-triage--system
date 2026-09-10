import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Snag My Home — Log Snags & Build Your Case',
  description:
    "List everything you're not happy with in your new home, in your own words. Snag My Home organises it into a report with AI-reviewed points to support your case with your builder, developer, or warranty provider.",
}

const STEPS = [
  {
    title: 'Log every snag',
    body: "Walk your home and add anything you're not happy with - a gap, a mark, a door that won't close. No technical knowledge needed. If it bothers you, it's a snag.",
  },
  {
    title: 'Add photos & location',
    body: 'Attach a photo and note where it is, if you have them. Both are optional - a plain description is enough to get started.',
  },
  {
    title: 'Generate your report',
    body: "When you're done, generate a report. It reviews everything you've logged together, spots patterns across snags, and drafts points to help support your case.",
  },
]

export default function SnagMyHomeLanding() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold text-brand-ink">Snag My Home</span>
          </div>
          <Link href="/login?redirect=/snag" className="text-sm font-medium text-slate-500 hover:text-brand-primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-brand-ink sm:text-4xl">
            Not happy with your new home? Log it. Build your case.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
            You don't need to know what caused it - just describe what's wrong. Snag My Home turns your list into a
            clear report, with AI-reviewed points to help strengthen your case.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup/homeowner"
              className="w-full rounded-md bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
            >
              Get started - it's free
            </Link>
            <Link
              href="/login?redirect=/snag"
              className="w-full rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-white sm:w-auto"
            >
              I already have an account
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h2 className="mt-3 text-base font-semibold text-slate-900">{step.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Snag My Home organises and strengthens the case built from your own descriptions - it doesn't replace a
          professional survey, and it won't invent a cause you haven't described. Every conclusion is grounded in
          what you've actually logged.
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">Snag My Home is part of InspectIQ.</p>
      </main>
    </div>
  )
}
