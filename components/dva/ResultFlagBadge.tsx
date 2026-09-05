import { ResultFlag } from '@/lib/dva/types'

const LABELS: Record<ResultFlag, string> = {
  pass: 'Pass',
  'at-risk': 'At risk',
  fail: 'Fail',
}

const COLORS: Record<ResultFlag, string> = {
  pass: 'bg-emerald-600/10 text-emerald-700',
  'at-risk': 'bg-amber-500/10 text-amber-700',
  fail: 'bg-red-600/10 text-red-700',
}

export default function ResultFlagBadge({ flag, className = '' }: { flag: ResultFlag; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${COLORS[flag]} ${className}`}>
      {LABELS[flag]}
    </span>
  )
}
