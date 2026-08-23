type Status = 'draft' | 'confirmed' | 'assigned' | 'pending_approval' | 'closed' | 'rejected'

const LABELS: Record<Status, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  pending_approval: 'Pending approval',
  closed: 'Closed',
  rejected: 'Rejected',
}

const COLORS: Record<Status, string> = {
  draft: 'bg-status-draft/10 text-status-draft',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed',
  assigned: 'bg-status-assigned/10 text-status-assigned',
  pending_approval: 'bg-status-pendingApproval/10 text-status-pendingApproval',
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
