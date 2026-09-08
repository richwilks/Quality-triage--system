import { ReportLayoutTheme } from '@/lib/reg38ReportLayouts'

type MetaItem = { label: string; value: string }

// Shared cover-page treatment for every generated PDF report in the app
// (Reg 38 / Golden Thread, the defect report, the as-built record) - one
// company-wide layout choice (company_settings.reg38_report_layout, despite
// the column name predating this generalization) styles all of them, so
// picking "Modern" or "Editorial" once gives every export the same identity.
export default function ReportCover({
  layout,
  kicker,
  title,
  meta,
  coverPhotoUrl,
  logoUrl,
  logoAlt,
  accentColor,
}: {
  layout: ReportLayoutTheme
  kicker: string
  title: string
  meta: MetaItem[]
  coverPhotoUrl: string | null
  logoUrl: string | null
  logoAlt: string
  accentColor: string
}) {
  const hasPhoto = !!coverPhotoUrl
  // Each layout keeps its own cover treatment even without a cover photo (most
  // projects won't have one set) - only the <img> itself is conditional, so
  // Modern/Editorial still get their dark full-bleed panel and Classic/Corporate
  // still get their framed block, instead of every layout collapsing to the
  // same plain look whenever there's no photo.
  const style = layout.coverStyle
  const tt = layout.headingCase

  return (
    <section className={`report-page report-cover report-cover--${style}`}>
      {style === 'full-bleed-photo' && hasPhoto && (
        <>
          <img src={coverPhotoUrl!} alt={title} className="report-cover-photo" />
          <div className="report-cover-gradient" />
        </>
      )}
      {style === 'inset-photo' && (
        <div
          className={`report-cover-inset-frame${hasPhoto ? '' : ' report-cover-inset-frame--empty'}`}
          style={{ borderColor: accentColor, background: hasPhoto ? undefined : `${accentColor}1A` }}
        >
          {hasPhoto && <img src={coverPhotoUrl!} alt={title} className="report-cover-inset-photo" />}
        </div>
      )}
      <div className={`report-cover-content report-cover-content--${style}`}>
        {logoUrl && <img src={logoUrl} alt={logoAlt} className="report-cover-logo" />}
        <p
          className="report-kicker"
          style={{ color: style === 'full-bleed-photo' ? '#fff' : accentColor, textTransform: tt }}
        >
          {kicker}
        </p>
        <h1
          className="report-cover-title"
          style={{
            fontFamily: layout.headingFont,
            color: style === 'full-bleed-photo' ? '#fff' : layout.ink,
            textTransform: tt,
          }}
        >
          {title}
        </h1>
        {meta.length > 0 && (
          <div className={`report-cover-meta report-cover-meta--${style}`}>
            {meta.map((m) => (
              <div key={m.label}>
                <span className="report-cover-meta-label">{m.label}</span>
                <span className="report-cover-meta-value">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .report-cover {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 480px;
          padding: 0;
          overflow: hidden;
          position: relative;
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
          padding: 40px;
        }
        .report-cover--inset-photo {
          justify-content: flex-start;
          padding: 40px 40px 0;
        }
        .report-cover--inset-photo .report-cover-content {
          padding: 32px 0 40px;
        }
        .report-cover--solid-color {
          background: ${accentColor};
          justify-content: center;
          align-items: flex-start;
        }
        .report-cover--solid-color .report-cover-content {
          padding: 0 40px;
        }
        .report-cover-inset-frame {
          border: 6px solid;
          margin: 0 0 28px;
          overflow: hidden;
        }
        .report-cover-inset-photo {
          display: block;
          width: 100%;
          max-height: 280px;
          object-fit: cover;
        }
        .report-cover-inset-frame--empty {
          min-height: 160px;
        }
        .report-cover-logo {
          height: 32px;
          width: auto;
          object-fit: contain;
          margin-bottom: 18px;
        }
        .report-kicker {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          margin: 0 0 10px;
        }
        .report-cover-title {
          font-size: 32px;
          font-weight: 700;
          line-height: 1.15;
          margin: 0 0 22px;
        }
        .report-cover-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 28px;
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
          font-size: 13px;
          font-weight: 500;
          margin-top: 2px;
        }
      `}</style>
    </section>
  )
}
