import { ReportLayoutTheme } from '@/lib/reg38ReportLayouts'
import { Reg38ReportSection } from '@/lib/reg38ReportTemplate'

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
  const hasPhoto = !!coverPhotoUrl
  const effectiveCoverStyle = hasPhoto ? layout.coverStyle : 'solid-color'

  const tocItems = [{ key: 'executive-summary', title: 'Executive Summary' }, ...sections.map((s) => ({ key: s.key, title: s.title }))]

  return (
    <div className="report-document" style={{ fontFamily: layout.bodyFont, color: layout.ink, background: layout.paper }}>
      {/* Cover page */}
      <section className={`report-page report-cover report-cover--${effectiveCoverStyle}`}>
        {effectiveCoverStyle === 'full-bleed-photo' && (
          <>
            <img src={coverPhotoUrl!} alt={projectName} className="report-cover-photo" />
            <div className="report-cover-gradient" />
          </>
        )}
        {effectiveCoverStyle === 'inset-photo' && (
          <div className="report-cover-inset-frame" style={{ borderColor: accentColor }}>
            <img src={coverPhotoUrl!} alt={projectName} className="report-cover-inset-photo" />
          </div>
        )}
        <div className={`report-cover-content report-cover-content--${effectiveCoverStyle}`}>
          {logoUrl && <img src={logoUrl} alt={companyName || 'Logo'} className="report-cover-logo" />}
          <p
            className="report-kicker"
            style={{
              color: effectiveCoverStyle === 'full-bleed-photo' ? '#fff' : accentColor,
              textTransform: layout.headingCase,
            }}
          >
            Regulation 38 / Golden Thread &mdash; {kindLabel}
          </p>
          <h1
            className="report-cover-title"
            style={{
              fontFamily: layout.headingFont,
              color: effectiveCoverStyle === 'full-bleed-photo' ? '#fff' : layout.ink,
              textTransform: layout.headingCase,
            }}
          >
            {projectName}
          </h1>
          <div className={`report-cover-meta report-cover-meta--${effectiveCoverStyle}`}>
            {principalContractor && (
              <div>
                <span className="report-cover-meta-label">Principal Contractor</span>
                <span className="report-cover-meta-value">{principalContractor}</span>
              </div>
            )}
            {projectAddress && (
              <div>
                <span className="report-cover-meta-label">Address</span>
                <span className="report-cover-meta-value">{projectAddress}</span>
              </div>
            )}
            <div>
              <span className="report-cover-meta-label">Date</span>
              <span className="report-cover-meta-value">{generatedOn}</span>
            </div>
            <div>
              <span className="report-cover-meta-label">Revision</span>
              <span className="report-cover-meta-value">Rev {revision}</span>
            </div>
          </div>
        </div>
      </section>

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

        .report-cover {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 640px;
          padding: 0;
          overflow: hidden;
        }
        .report-cover--full-bleed-photo {
          background: #111;
        }
        .report-cover-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .report-cover-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.15) 55%, rgba(0, 0, 0, 0) 100%);
        }
        .report-cover-content {
          position: relative;
          padding: 48px;
        }
        .report-cover--inset-photo {
          justify-content: flex-start;
          padding: 56px 48px 0;
        }
        .report-cover--inset-photo .report-cover-content {
          padding: 40px 0 56px;
        }
        .report-cover--solid-color {
          background: ${accentColor};
          justify-content: center;
          align-items: flex-start;
        }
        .report-cover--solid-color .report-cover-content {
          padding: 0 56px;
        }
        .report-cover-inset-frame {
          border: 6px solid;
          margin: 0 0 32px;
          overflow: hidden;
        }
        .report-cover-inset-photo {
          display: block;
          width: 100%;
          max-height: 340px;
          object-fit: cover;
        }
        .report-cover-logo {
          height: 36px;
          width: auto;
          object-fit: contain;
          margin-bottom: 20px;
        }
        .report-kicker {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          margin: 0 0 12px;
        }
        .report-cover-title {
          font-size: 40px;
          font-weight: 700;
          line-height: 1.15;
          margin: 0 0 28px;
        }
        .report-cover-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 32px;
        }
        .report-cover-meta--solid-color {
          color: #fff;
        }
        .report-cover-meta-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .report-cover-meta-value {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-top: 2px;
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
