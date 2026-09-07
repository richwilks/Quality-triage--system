import { ReportLayoutTheme } from '@/lib/reg38ReportLayouts'
import { Reg38ReportSection } from '@/lib/reg38ReportTemplate'
import ReportCover from '@/components/reportLayouts/ReportCover'

type ReportDocumentProps = {
  layout: ReportLayoutTheme
  projectName: string
  companyName: string | null
  principalContractor: string | null
  projectAddress: string | null
  coverPhotoUrl: string | null
  logoUrl: string | null
  accentColor: string
  hideInspectIQ: boolean
  kind: 'status' | 'handover'
  revision: number
  generatedOn: string
  executiveSummary: string
  sections: Reg38ReportSection[]
}

function SectionBody({ body }: { body: string }) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="report-body-text">
          {p}
        </p>
      ))}
    </>
  )
}

export default function ReportDocument({
  layout,
  projectName,
  companyName,
  principalContractor,
  projectAddress,
  coverPhotoUrl,
  logoUrl,
  accentColor,
  hideInspectIQ,
  kind,
  revision,
  generatedOn,
  executiveSummary,
  sections,
}: ReportDocumentProps) {
  const kindLabel = kind === 'handover' ? 'Handover Pack' : 'Status Report'

  const tocItems = [{ key: 'executive-summary', title: 'Executive Summary' }, ...sections.map((s) => ({ key: s.key, title: s.title }))]

  const coverMeta = [
    ...(principalContractor ? [{ label: 'Principal Contractor', value: principalContractor }] : []),
    ...(projectAddress ? [{ label: 'Address', value: projectAddress }] : []),
    { label: 'Date', value: generatedOn },
    { label: 'Revision', value: `Rev ${revision}` },
  ]

  return (
    <div className="report-document" style={{ fontFamily: layout.bodyFont, color: layout.ink, background: layout.paper }}>
      <ReportCover
        layout={layout}
        kicker={`Regulation 38 / Golden Thread — ${kindLabel}`}
        title={projectName}
        meta={coverMeta}
        coverPhotoUrl={coverPhotoUrl}
        logoUrl={logoUrl}
        logoAlt={companyName || 'Logo'}
        accentColor={accentColor}
      />

      {/* Contents page */}
      <section className="report-page report-contents">
        <h2
          className="report-section-heading"
          style={{ fontFamily: layout.headingFont, color: accentColor, textTransform: layout.headingCase }}
        >
          Contents
        </h2>
        <div className={`report-rule report-rule--${layout.ruleStyle}`} style={{ background: accentColor }} />
        <ol className="report-toc">
          {tocItems.map((item, i) => (
            <li key={item.key}>
              <a href={`#${item.key}`} className="report-toc-link">
                <span className="report-toc-number" style={{ color: accentColor }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{item.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* Executive summary */}
      <section id="executive-summary" className="report-page report-section">
        <h2
          className="report-section-heading"
          style={{ fontFamily: layout.headingFont, color: accentColor, textTransform: layout.headingCase }}
        >
          Executive Summary
        </h2>
        <div className={`report-rule report-rule--${layout.ruleStyle}`} style={{ background: accentColor }} />
        {layout.key === 'editorial' ? (
          <p className="report-pull-quote" style={{ borderColor: accentColor, fontFamily: layout.headingFont }}>
            {executiveSummary}
          </p>
        ) : (
          <SectionBody body={executiveSummary} />
        )}
      </section>

      {/* Body sections */}
      {sections.map((s) => (
        <section key={s.key} id={s.key} className="report-page report-section">
          <h2
            className="report-section-heading"
            style={{ fontFamily: layout.headingFont, color: accentColor, textTransform: layout.headingCase }}
          >
            {s.title}
          </h2>
          <div className={`report-rule report-rule--${layout.ruleStyle}`} style={{ background: accentColor }} />
          <SectionBody body={s.body} />
        </section>
      ))}

      {!hideInspectIQ && <p className="report-footer">Generated with InspectIQ</p>}

      <style jsx>{`
        .report-document {
          font-size: 14px;
          line-height: 1.7;
        }
        .report-page {
          padding: 56px 48px;
          min-height: 900px;
          position: relative;
          break-after: page;
          page-break-after: always;
        }
        .report-page:last-of-type {
          break-after: auto;
          page-break-after: auto;
        }
        @media screen {
          .report-page {
            border-bottom: 1px dashed rgba(0, 0, 0, 0.12);
            min-height: 0;
          }
        }

        .report-section-heading {
          font-size: 26px;
          font-weight: 700;
          margin: 0 0 10px;
        }
        .report-rule--thin {
          height: 1px;
          margin-bottom: 24px;
          opacity: 0.35;
        }
        .report-rule--block {
          height: 4px;
          width: 64px;
          margin-bottom: 24px;
        }
        .report-body-text {
          margin: 0 0 14px;
          white-space: pre-wrap;
        }
        .report-pull-quote {
          font-size: 22px;
          line-height: 1.5;
          font-style: italic;
          border-left: 4px solid;
          padding-left: 20px;
          margin: 0;
        }

        .report-toc {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .report-toc li {
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .report-toc-link {
          display: flex;
          align-items: baseline;
          gap: 16px;
          padding: 14px 0;
          text-decoration: none;
          color: inherit;
          font-size: 15px;
          font-weight: 500;
        }
        .report-toc-number {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .report-footer {
          text-align: center;
          font-size: 10px;
          opacity: 0.4;
          padding: 24px 0;
        }

        section[id] {
          scroll-margin-top: 16px;
        }
      `}</style>
    </div>
  )
}
