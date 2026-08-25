export type ReportLayoutKey = 'classic' | 'modern' | 'minimal' | 'corporate' | 'editorial'

export type ReportLayoutTheme = {
  key: ReportLayoutKey
  name: string
  description: string
  headingFont: string
  bodyFont: string
  coverStyle: 'full-bleed-photo' | 'inset-photo' | 'solid-color'
  defaultAccent: string
  ink: string
  paper: string
  headingCase: 'uppercase' | 'none'
  ruleStyle: 'thin' | 'block'
}

// Five distinct, professional preset looks. Each shares the same underlying
// data and section structure (ReportDocument) - only typography, cover
// treatment, and accent handling change, so quality stays consistent across
// all five without hand-building five separate page trees.
export const REPORT_LAYOUTS: ReportLayoutTheme[] = [
  {
    key: 'classic',
    name: 'Classic',
    description: 'Traditional consultancy report - serif headings, a framed cover photo, thin rules.',
    headingFont: "'Georgia', 'Times New Roman', serif",
    bodyFont: "'Georgia', 'Times New Roman', serif",
    coverStyle: 'inset-photo',
    defaultAccent: '#2A6F77',
    ink: '#1F2A2C',
    paper: '#FBF9F4',
    headingCase: 'none',
    ruleStyle: 'thin',
  },
  {
    key: 'modern',
    name: 'Modern',
    description: 'Full-bleed cover photo with a dark gradient, bold sans headings - a marketing-brochure feel.',
    headingFont: "'Helvetica Neue', Arial, sans-serif",
    bodyFont: "'Helvetica Neue', Arial, sans-serif",
    coverStyle: 'full-bleed-photo',
    defaultAccent: '#2A6F77',
    ink: '#111827',
    paper: '#FFFFFF',
    headingCase: 'uppercase',
    ruleStyle: 'block',
  },
  {
    key: 'minimal',
    name: 'Minimal',
    description: 'No cover photo required - typographic cover on a solid colour field, generous white space.',
    headingFont: "'Helvetica Neue', Arial, sans-serif",
    bodyFont: "Georgia, serif",
    coverStyle: 'solid-color',
    defaultAccent: '#24221D',
    ink: '#24221D',
    paper: '#FFFFFF',
    headingCase: 'none',
    ruleStyle: 'thin',
  },
  {
    key: 'corporate',
    name: 'Corporate',
    description: 'Structured, formal - numbered sections, a header band on every page, built for sign-off.',
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    coverStyle: 'inset-photo',
    defaultAccent: '#1F3A5F',
    ink: '#1A1A1A',
    paper: '#FFFFFF',
    headingCase: 'uppercase',
    ruleStyle: 'block',
  },
  {
    key: 'editorial',
    name: 'Editorial',
    description: 'Magazine-style - large serif display type, full-bleed cover, pull-quote executive summary.',
    headingFont: "'Georgia', 'Times New Roman', serif",
    bodyFont: "'Helvetica Neue', Arial, sans-serif",
    coverStyle: 'full-bleed-photo',
    defaultAccent: '#C97A4A',
    ink: '#1A1A1A',
    paper: '#FFFFFF',
    headingCase: 'none',
    ruleStyle: 'thin',
  },
]

export function reportLayoutByKey(key: string | null | undefined): ReportLayoutTheme {
  return REPORT_LAYOUTS.find((l) => l.key === key) || REPORT_LAYOUTS[0]
}
