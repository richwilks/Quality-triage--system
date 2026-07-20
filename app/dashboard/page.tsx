import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-500">
        Project overview coming soon.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
      <Link
  href="/dashboard/standards"
  className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
>
  Standards library
</Link>

  <Link
          href="/dashboard/new-defect"
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          + New defect
        </Link>
        <Link
          href="/dashboard/review"
          className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Review queue
        </Link>
        <Link
          href="/dashboard/new-defect-video"
          className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          + From video
        </Link>
        <Link
          href="/dashboard/notifications"
          className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Notifications
        </Link>
        <Link
          href="/dashboard/my-defects"
          className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          My assigned defects
        </Link>
        <Link
          href="/dashboard/drawings"
          className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Drawings
        </Link>
      </div>
    </div>
  )
}
