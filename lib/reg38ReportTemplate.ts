// Merge-token system for a company's own custom HTML report layout. A
// company uploads a full HTML/CSS document (fonts, colours, page structure
// all their own) containing these tokens; we substitute real report data
// and hand the result to DOMPurify before rendering, so full visual
// freedom doesn't come with a script-injection risk.

export type Reg38ReportSection = { key: string; title: string; body: string }

export type ReportTemplateData = {
  projectName: string
  companyName: string
  principalContractor: string
  projectAddress: string
  reportDate: string
  revision: number
  reportKind: string
  coverPhotoUrl: string
  logoUrl: string
  accentColor: string
  executiveSummary: string
  sections: Reg38ReportSection[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphsHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

export function buildTableOfContentsHtml(data: ReportTemplateData): string {
  const items = data.sections.map((s) => `<li><a href="#${s.key}">${escapeHtml(s.title)}</a></li>`).join('\n')
  return `<nav class="reg38-toc"><ol>${items}</ol></nav>`
}

export function buildSectionsHtml(data: ReportTemplateData): string {
  return data.sections
    .map(
      (s) => `<section id="${s.key}" class="reg38-section">
  <h2>${escapeHtml(s.title)}</h2>
  ${paragraphsHtml(s.body)}
</section>`
    )
    .join('\n\n')
}

export function renderCustomReportHtml(template: string, data: ReportTemplateData): string {
  const tokens: Record<string, string> = {
    PROJECT_NAME: escapeHtml(data.projectName),
    COMPANY_NAME: escapeHtml(data.companyName),
    PRINCIPAL_CONTRACTOR: escapeHtml(data.principalContractor),
    PROJECT_ADDRESS: escapeHtml(data.projectAddress),
    REPORT_DATE: escapeHtml(data.reportDate),
    REVISION: escapeHtml(`Rev ${data.revision}`),
    REPORT_KIND: escapeHtml(data.reportKind),
    COVER_PHOTO_URL: escapeHtml(data.coverPhotoUrl),
    LOGO_URL: escapeHtml(data.logoUrl),
    ACCENT_COLOR: escapeHtml(data.accentColor),
    EXECUTIVE_SUMMARY: paragraphsHtml(data.executiveSummary),
    TABLE_OF_CONTENTS: buildTableOfContentsHtml(data),
    SECTIONS: buildSectionsHtml(data),
  }

  let html = template
  for (const [key, value] of Object.entries(tokens)) {
    html = html.split(`{{${key}}}`).join(value)
  }
  return html
}

export const REPORT_TEMPLATE_TOKENS = [
  { token: 'PROJECT_NAME', description: 'Project name' },
  { token: 'COMPANY_NAME', description: "Your company's name" },
  { token: 'PRINCIPAL_CONTRACTOR', description: 'Principal contractor, from the project record' },
  { token: 'PROJECT_ADDRESS', description: 'Project address, from the project record' },
  { token: 'REPORT_DATE', description: 'The date this report was generated' },
  { token: 'REVISION', description: 'e.g. "Rev 3" - increments each time you generate this report kind for the project' },
  { token: 'REPORT_KIND', description: '"Status Report" or "Handover Pack"' },
  { token: 'COVER_PHOTO_URL', description: "The project's cover photo URL - use in an <img> or CSS background-image" },
  { token: 'LOGO_URL', description: "Your company's logo URL" },
  { token: 'ACCENT_COLOR', description: 'Your branding accent colour, as a hex string' },
  { token: 'EXECUTIVE_SUMMARY', description: 'The generated executive summary, as HTML paragraphs' },
  { token: 'TABLE_OF_CONTENTS', description: 'An auto-built <nav><ol>...</ol></nav> linking to each section by id' },
  { token: 'SECTIONS', description: 'Every report section as HTML, each wrapped in <section id="...">' },
]
