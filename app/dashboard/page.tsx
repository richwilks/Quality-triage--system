import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-500">
        Project overview coming soon.
      </p>

      <Link
        href="/dashboard/new-defect"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        + New defect
      </Link>
    </div>
  )
}
