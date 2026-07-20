type Status = 'draft' | 'confirmed' | 'assigned' | 'closed' | 'rejected'

const LABELS: Record<Status, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  closed: 'Closed',
  rejected: 'Rejected',
}

const COLORS: Record<Status, string> = {
  draft: 'bg-status-draft/10 text-status-draft',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed',
  assigned: 'bg-status-assigned/10 text-status-assigned',
  closed: 'bg-status-closed/10 text-status-closed',
  rejected: 'bg-status-rejected/10 text-status-rejected',
}

export default function StatusBadge({ status }: { status: string }) {
  const key = (status as Status) in LABELS ? (status as Status) : 'draft'
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[key]}`}
    >
      {LABELS[key]}
    </span>
  )
}
