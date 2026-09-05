import { AccessFlag } from '@/lib/dva/types'

const LABELS: Record<AccessFlag, string> = {
  pass: 'Pass',
  marginal: 'Marginal',
  fail: 'Fail',
}

const COLORS: Record<AccessFlag, string> = {
  pass: 'bg-emerald-600/10 text-emerald-700',
  marginal: 'bg-amber-500/10 text-amber-700',
  fail: 'bg-red-600/10 text-red-700',
}

export default function AccessFlagBadge({ flag, className = '' }: { flag: AccessFlag; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${COLORS[flag]} ${className}`}>
      {LABELS[flag]}
    </span>
  )
}
