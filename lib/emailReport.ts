// No email-sending service is configured for InspectIQ itself, so "email a
// report" opens the user's own email app with a prefilled draft (sent from
// their own address) rather than sending server-side. A mailto: link can't
// attach a file, so the draft points the recipient at the report's own page
// (works for anyone with project access) and reminds the sender to attach
// the PDF they just saved for anyone external.
export function buildReportMailto(subject: string, reportUrl: string): string {
  const body = [
    'Sharing this report - see the link below to view it online.',
    '',
    reportUrl,
    '',
    "If you're sending this to someone without an InspectIQ login, attach the PDF you just saved instead (use \"Print / Save as PDF\" first).",
  ].join('\n')

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
