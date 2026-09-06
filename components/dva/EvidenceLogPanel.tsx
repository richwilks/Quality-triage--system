'use client'

import { EvidenceRecord, downloadEvidenceJson } from '@/lib/dva/evidenceLog'
import ResultFlagBadge from './ResultFlagBadge'
import AccessFlagBadge from './AccessFlagBadge'

export default function EvidenceLogPanel({
  records,
  onView,
}: {
  records: EvidenceRecord[]
  onView: (record: EvidenceRecord) => void
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-surface p-6 text-sm text-deck-dim">
        No evidence logged yet. Run a calculation, then use &ldquo;Log as evidence&rdquo; to save a timestamped record
        for the Golden Thread / Regulation 38 audit trail.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-deck-border bg-deck-surface shadow-sm">
      <ul className="divide-y divide-deck-border">
        {records.map((record) => (
          <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-deck-text">
                {record.junction.name} — {record.method === 'monte-carlo' ? 'Monte Carlo' : 'Worst-case / RSS'}
              </p>
              <p className="text-xs text-deck-dim">{new Date(record.createdAt).toLocaleString('en-GB')}</p>
            </div>
            <div className="flex items-center gap-2">
              <ResultFlagBadge flag={record.overallFlag} className="text-xs" />
              {record.buildability && record.buildability.fixings.length > 0 && (
                <AccessFlagBadge flag={record.buildability.overallFlag} className="text-xs" />
              )}
              <button
                type="button"
                onClick={() => onView(record)}
                className="rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-body hover:bg-deck-raised"
              >
                View / Print
              </button>
              <button
                type="button"
                onClick={() => downloadEvidenceJson(record)}
                className="rounded-md border border-deck-border px-3 py-1.5 text-xs font-medium text-deck-body hover:bg-deck-raised"
              >
                Export JSON
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
