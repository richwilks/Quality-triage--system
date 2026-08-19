'use client'

const GREEN = '#2A3D39'
const GOLD = '#A67C52'
const CREAM = '#FAF7F2'

type Recommendation = {
  ref: string
  location: string
  description: string
  priority: 'Priority' | 'Standard'
  status: 'New' | 'Retained'
}

const RECOMMENDATIONS: Recommendation[] = [
  { ref: 'R-01', location: 'Parkade – Level P1', description: 'Repair spalled concrete and exposed rebar at column C4, east ramp.', priority: 'Priority', status: 'Retained' },
  { ref: 'R-02', location: 'Building Envelope – South Elevation', description: 'Renew perished sealant at window/cladding junctions before next wet season.', priority: 'Priority', status: 'Retained' },
  { ref: 'R-03', location: 'Mechanical Room', description: 'Replace domestic hot water recirculation pump nearing end of service life.', priority: 'Priority', status: 'New' },
  { ref: 'R-04', location: 'Parkade – Level P1', description: 'Monitor hairline cracking at ramp expansion joint; reassess next cycle.', priority: 'Standard', status: 'Retained' },
  { ref: 'R-05', location: 'Roof – Main Tower', description: 'Clear debris from roof drains and re-inspect membrane at scupper penetrations.', priority: 'Standard', status: 'Retained' },
  { ref: 'R-06', location: 'Amenity Terrace', description: 'Re-caulk paver joints where minor weed growth has been observed.', priority: 'Standard', status: 'New' },
  { ref: 'R-07', location: 'Building Envelope – North Elevation', description: 'Touch up coating at balcony guard fixings showing early surface corrosion.', priority: 'Standard', status: 'Retained' },
  { ref: 'R-08', location: 'Landscaping – Perimeter', description: 'Regrade planting bed where drainage falls back toward the foundation wall.', priority: 'Standard', status: 'Retained' },
  { ref: 'R-09', location: 'Fire Systems', description: 'Confirm annual fire alarm verification certificate is on file for the current cycle.', priority: 'Standard', status: 'New' },
]

const PRIORITY_ITEMS = RECOMMENDATIONS.filter((r) => r.priority === 'Priority')

const ADVISORY_LOG = [
  { date: '18 Feb 2027', topic: 'Water ingress reported, Unit 214 balcony', raisedBy: 'Strata Council', outcome: 'Site visit confirmed a localised sealant failure, folded into R-02; interim monitoring advised.' },
  { date: '06 Apr 2027', topic: 'Parkade concrete spalling query', raisedBy: 'Property Manager', outcome: 'Confirmed as pre-existing R-01; no change in urgency since last report.' },
  { date: '22 Jun 2027', topic: 'Hot water pressure complaints, Tower A', raisedBy: 'Strata Council', outcome: 'Attributed to recirculation pump wear; raised as new recommendation R-03.' },
  { date: '30 Aug 2027', topic: 'Roof drain capacity during heavy rainfall', raisedBy: 'Building Manager', outcome: 'Advised on interim debris clearing; formalised as R-05 for the current cycle.' },
  { date: '11 Oct 2027', topic: 'General condition query ahead of AGM', raisedBy: 'Strata Council', outcome: 'Summary of current recommendations provided in advance of annual general meeting.' },
]

export default function AssetConditionExampleReport() {
  return (
    <div className="min-h-screen px-4 py-8 print:px-0 print:py-0" style={{ backgroundColor: CREAM }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-xs text-stone-500">
            Example / template output — Recommendations and Advisory Log below are illustrative sample content.
          </p>
          <button
            onClick={() => window.print()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: GREEN }}
          >
            Print / Save as PDF
          </button>
        </div>

        {/* ===================== COVER ===================== */}
        <section className="overflow-hidden rounded-xl border shadow-sm print:rounded-none print:border-0 print:shadow-none" style={{ borderColor: '#E4DCCB', backgroundColor: '#FFFFFF' }}>
          <div className="px-10 pb-8 pt-10">
            <img src="/branding/copsefield/logo-dark.png" alt="Copsefield Group" className="h-16 w-auto" />
          </div>
          <div className="px-10 py-8" style={{ backgroundColor: GREEN }}>
            <h1 className="text-2xl font-bold text-white">Copsefield Report</h1>
            <p className="text-2xl font-bold text-white">2027</p>
          </div>
          <div className="px-10 py-10 text-center">
            <p className="text-lg font-semibold" style={{ color: '#1F2320' }}>The Owners, Strata Plan EPS1234</p>
            <p className="mt-2 text-lg font-semibold" style={{ color: '#1F2320' }}>Lakeside Residences</p>
            <p className="mt-1 text-base font-semibold" style={{ color: '#1F2320' }}>123 Example Street, Kelowna, BC</p>
            <div className="mx-auto mt-8 max-w-xs space-y-1 text-xs text-stone-500">
              <p>Report: CPS-EPS1234-CR2027</p>
              <p>Prepared: 15 November 2027</p>
              <p>By: M. Wilks</p>
            </div>
          </div>
        </section>

        <div className="break-after-page" />

        {/* ===================== SECTION 2: ASSET OVERVIEW ===================== */}
        <section className="mt-6 overflow-hidden rounded-xl border shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none" style={{ borderColor: '#E4DCCB', backgroundColor: '#FFFFFF' }}>
          <ReportHeaderBand />

          <div className="px-10 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Section 1</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: GREEN }}>Asset Overview</h2>
            <p className="text-base font-semibold" style={{ color: GREEN }}>Lakeside Residences</p>

            <p className="mt-5 text-sm leading-relaxed text-stone-700">
              Lakeside Residences remains in generally good condition, with no significant change in overall
              asset condition during the reporting period. Twenty recommendations remain current, including
              three priority items. Further detail and recommended next steps are provided within this report.
            </p>

            <div className="mt-7 space-y-5">
              <StatRow
                icon={<IconChecklist />}
                label="Asset Condition Rating"
                value="No change"
                caption="Indicates Copsefield's observed change in overall asset condition compared with the previous annual reporting period. This rating is a high-level view based on professional judgement following non-invasive visual inspection - it is not a structural, engineering or specialist assessment."
              />
              <StatRow
                icon={<IconShieldTools />}
                label="Priority Recommendations"
                value={String(PRIORITY_ITEMS.length)}
                caption="The total number of recommendations considered by Copsefield to warrant increased attention during the current reporting period."
              />
              <StatRow
                icon={<IconRuler />}
                label="Retained Recommendations"
                value="17"
                caption="Recommendations not currently progressed and retained for future consideration or monitoring."
              />
              <StatRow
                icon={<IconRuler />}
                label="12-Month Planning Allowance"
                value="$48,000 – $62,000"
                caption="Indicative allowance for completing all current Copsefield recommendations within the next 12 months. The current planning allowance is primarily driven by recommended parkade repairs, exterior sealant works and domestic hot water system improvements. The allowance assumes all current recommendations are progressed during the next 12 months and does not include items arising from future inspections or unforeseen conditions."
              />
              <StatRow
                icon={<IconShieldTrend />}
                label="Reserve Fund Impact"
                value="No material impact"
                caption="Copsefield's assessment of the potential impact current recommendations may have on the asset expenditure anticipated within the existing depreciation plan. Current recommendations are not expected to materially affect the existing long-term funding plan - the majority of identified requirements are consistent with anticipated asset expenditure, with no significant unplanned capital requirements currently identified."
              />
            </div>
          </div>
        </section>

        <div className="break-after-page" />

        {/* ===================== SECTION 3: RECOMMENDATIONS TABLE ===================== */}
        <section className="mt-6 overflow-hidden rounded-xl border shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none" style={{ borderColor: '#E4DCCB', backgroundColor: '#FFFFFF' }}>
          <ReportHeaderBand />

          <div className="px-10 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Section 2</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: GREEN }}>Recommendations</h2>
            <p className="mt-1 text-xs text-stone-500">
              Sample of current recommendations shown below. Priority items are carried forward into Section 3.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-wide text-stone-500" style={{ borderColor: '#E4DCCB' }}>
                    <th className="py-2 pr-2">Ref</th>
                    <th className="py-2 pr-2">Location</th>
                    <th className="py-2 pr-2">Recommendation</th>
                    <th className="py-2 pr-2">Priority</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {RECOMMENDATIONS.map((r) => (
                    <tr key={r.ref} className="border-b" style={{ borderColor: '#F0EBDF' }}>
                      <td className="py-2 pr-2 font-semibold text-stone-800">{r.ref}</td>
                      <td className="py-2 pr-2 text-stone-600">{r.location}</td>
                      <td className="py-2 pr-2 text-stone-700">{r.description}</td>
                      <td className="py-2 pr-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={
                            r.priority === 'Priority'
                              ? { backgroundColor: '#F3E7DA', color: GOLD }
                              : { backgroundColor: '#EEF1EF', color: GREEN }
                          }
                        >
                          {r.priority}
                        </span>
                      </td>
                      <td className="py-2 text-stone-600">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="break-after-page" />

        {/* ===================== SECTION 4: PRIORITIES NARRATIVE ===================== */}
        <section className="mt-6 overflow-hidden rounded-xl border shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none" style={{ borderColor: '#E4DCCB', backgroundColor: '#FFFFFF' }}>
          <ReportHeaderBand />

          <div className="px-10 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Section 3</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: GREEN }}>Priorities</h2>
            <p className="mt-1 text-xs text-stone-500">
              The three items below are considered priority for the current reporting period and warrant
              increased attention ahead of the next annual visit.
            </p>

            <div className="mt-5 space-y-5">
              {PRIORITY_ITEMS.map((r) => (
                <div key={r.ref} className="border-l-2 pl-4" style={{ borderColor: GOLD }}>
                  <p className="text-sm font-semibold" style={{ color: GREEN }}>
                    {r.ref} — {r.location}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-700">{r.description}</p>
                </div>
              ))}
              <p className="pt-2 text-sm leading-relaxed text-stone-700">
                None of the above are considered to present an immediate safety concern. Copsefield recommends
                these items be progressed within the current 12-month planning allowance to avoid escalation
                into higher-cost remedial work at the next reporting cycle.
              </p>
            </div>
          </div>
        </section>

        <div className="break-after-page" />

        {/* ===================== SECTION 5: ADVISORY LOG ===================== */}
        <section className="mt-6 overflow-hidden rounded-xl border shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none" style={{ borderColor: '#E4DCCB', backgroundColor: '#FFFFFF' }}>
          <ReportHeaderBand />

          <div className="px-10 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Section 4</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: GREEN }}>Advisory Log</h2>
            <p className="mt-1 text-xs text-stone-500">
              A record of advisory contacts with Copsefield during the current reporting period.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-wide text-stone-500" style={{ borderColor: '#E4DCCB' }}>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Topic</th>
                    <th className="py-2 pr-2">Raised by</th>
                    <th className="py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {ADVISORY_LOG.map((a, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: '#F0EBDF' }}>
                      <td className="py-2 pr-2 whitespace-nowrap text-stone-600">{a.date}</td>
                      <td className="py-2 pr-2 font-medium text-stone-800">{a.topic}</td>
                      <td className="py-2 pr-2 text-stone-600">{a.raisedBy}</td>
                      <td className="py-2 text-stone-700">{a.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 flex items-center justify-between border-t pt-4 text-[10px] text-stone-400" style={{ borderColor: '#E4DCCB' }}>
              <span>Copsefield Group — Maintaining Standards</span>
              <span>Report CPS-EPS1234-CR2027 · Page 5 of 5</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ReportHeaderBand() {
  return (
    <div className="flex items-center justify-center px-10 py-6" style={{ backgroundColor: GREEN }}>
      <img src="/branding/copsefield/logo-light.png" alt="Copsefield Group" className="h-14 w-auto" />
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode
  label: string
  value: string
  caption: string
}) {
  return (
    <div className="flex gap-4 border-b pb-5" style={{ borderColor: '#F0EBDF' }}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: '#F3E7DA' }}>
        <span style={{ color: GOLD }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: GREEN }}>{label}</p>
          <p className="whitespace-nowrap text-sm font-bold" style={{ color: GREEN }}>{value}</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">{caption}</p>
      </div>
    </div>
  )
}

function IconChecklist() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 3h6v3H9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 4H5a1 1 0 00-1 1v15a1 1 0 001 1h14a1 1 0 001-1V5a1 1 0 00-1-1h-1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12l2 2 3-4M8 17l2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconShieldTools() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 15l6-6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRuler() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 15l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconShieldTrend() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 14l3-3 2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
