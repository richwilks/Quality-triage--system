import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default function SnagLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/snag" className="flex items-center gap-2">
            <img src="/icon-192.png" alt="InspectIQ" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold text-brand-ink">Snag My Home</span>
          </Link>
          <SignOutButton className="text-sm font-medium text-slate-500 hover:text-brand-primary" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  )
}
