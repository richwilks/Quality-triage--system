import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Snag My Home',
  description: 'Terms and conditions for using Snag My Home.',
}

const EFFECTIVE_DATE = '9 September 2026'

export default function SnagMyHomeTermsPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-base font-semibold text-brand-ink">Snag My Home</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/snag-my-home" className="text-sm font-medium text-brand-primary">
          &larr; Back
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-brand-ink">Terms &amp; Conditions</h1>
        <p className="mt-1 text-sm text-slate-500">Effective {EFFECTIVE_DATE}</p>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-base font-semibold text-slate-900">1. Who this service is for</h2>
            <p className="mt-2">
              Snag My Home is provided for private individuals logging snags on their own residential home, for
              their own personal, non-commercial use. By creating an account you confirm that:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>you are the homeowner or occupier of the property you register, or you have the homeowner's permission to log snags on their behalf;</li>
              <li>you are using the service for that one property, not on behalf of a client, employer, or third party;</li>
              <li>you are not a builder, contractor, developer, surveyor, snagging inspector, letting or estate agent, property manager, or other construction or property professional using the service in that professional capacity.</li>
            </ul>
            <p className="mt-2">
              Snag My Home is not available for professional, trade, or commercial use, including managing snags across
              multiple properties or on behalf of clients. Professional users of the InspectIQ platform should use an
              InspectIQ company account instead.
            </p>
            <p className="mt-2">
              Each account is limited to one property: the address you register at sign-up cannot be changed
              afterwards, and the same address cannot be used to register a second account. If you move home or need
              to snag a different property, you'll need to contact us or create a separate account for that address.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">2. What the service does</h2>
            <p className="mt-2">
              The service lets you record snags in your own words, with an optional photo and location, and generate a
              written report. The report is produced by reviewing your own logged entries using an AI system, which
              summarises what you've recorded and highlights patterns or connections across your entries (for example,
              the same issue recurring in several rooms).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">3. Not a professional survey or inspection</h2>
            <p className="mt-2">
              The report is based entirely on the information you enter - it is not a site visit, survey, structural
              inspection, or expert opinion, and nothing in it should be treated as one. It does not diagnose a
              technical cause with certainty, and it may miss things a qualified inspector would identify in person.
              Before relying on the report for a legal, financial, or insurance decision, or a claim against a
              builder, developer, or warranty provider, you should get independent professional advice - for example
              from a RICS-qualified surveyor, structural engineer, or solicitor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">4. Accuracy</h2>
            <p className="mt-2">
              The report can only be as accurate and complete as what you enter. We do not independently verify your
              descriptions, and we accept no responsibility for a snag being missed, understated, or misdescribed
              because it was not recorded, or was recorded inaccurately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">5. Your data</h2>
            <p className="mt-2">
              We store the property address, snags, photos, and reports you enter in order to provide the service to
              you. This information is used only to generate your reports and is not sold or shared with third
              parties, except where required by law or to operate the service itself (for example, our hosting and AI
              processing providers). You can request deletion of your account and data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">6. Liability</h2>
            <p className="mt-2">
              The service is provided "as is". To the fullest extent permitted by law, we exclude liability for any
              loss arising from your reliance on a generated report, including in connection with a dispute with a
              builder, developer, or warranty provider. Nothing in these terms limits liability for death or personal
              injury caused by negligence, or for fraud, or any other liability that cannot lawfully be excluded.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">7. Misuse and account action</h2>
            <p className="mt-2">
              We may suspend or close an account that we reasonably believe is being used professionally or
              commercially, for a property other than the account holder's own home, or otherwise in breach of these
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">8. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Continuing to use the service after an update means you
              accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">9. Governing law</h2>
            <p className="mt-2">These terms are governed by the law of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">10. Contact</h2>
            <p className="mt-2">
              Questions about these terms, or requests to delete your data, can be sent to the InspectIQ team through
              your account.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
