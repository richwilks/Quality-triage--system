'use client'

import { useRouter } from 'next/navigation'

export default function PageHeader({ title }: { title: string }) {
  const router = useRouter()

  return (
    <div className="mb-2 flex items-center gap-3">
      <button
        onClick={() => router.back()}
        aria-label="Back"
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <img src="/icon-192.png" alt="InspectIQ" className="h-7 w-7 rounded-md" />
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    </div>
  )
}
