'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { syncCompanyAccess } from '@/lib/companySync'

const COPSEFIELD_HOSTS = ['copsefield.com', 'www.copsefield.com']

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isCopsefield, setIsCopsefield] = useState(false)

  useEffect(() => {
    setIsCopsefield(COPSEFIELD_HOSTS.includes(window.location.hostname))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
await syncCompanyAccess(supabase)
    const redirectTo = searchParams.get('redirect')
    router.push(redirectTo || (isCopsefield ? '/copsefield' : '/choose'))
    router.refresh()
  }

  const blocked = searchParams.get('blocked') === '1'
  const noAccess = searchParams.get('no_access') === '1'

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 ${isCopsefield ? 'bg-deck-bg' : 'bg-brand-bg'}`}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          {isCopsefield ? (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-copsefield-dark p-2 shadow-sm">
              <img src="/branding/copsefield/shield-icon.png" alt="Copsefield Group" className="h-full w-full object-contain" />
            </span>
          ) : (
            <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
          )}
          <h1 className={`mt-3 text-2xl font-semibold ${isCopsefield ? 'text-deck-text' : 'text-brand-ink'}`}>
            {isCopsefield ? 'Copsefield Group' : 'InspectIQ'}
          </h1>
          <p className={`mt-1 text-sm ${isCopsefield ? 'text-deck-dim' : 'text-slate-500'}`}>
            {isCopsefield ? 'Sign in to manage properties and tickets.' : 'Sign in to view and manage defects.'}
          </p>
        </div>

        <div className={`rounded-2xl border p-8 shadow-sm ${isCopsefield ? 'border-deck-border bg-deck-surface' : 'border-slate-200 bg-white'}`}>
          {blocked && <p className="mb-4 text-sm text-red-600">Your account has been blocked. Contact your administrator.</p>}
          {noAccess && <p className="mb-4 text-sm text-red-600">That account doesn&apos;t have Copsefield access.</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${isCopsefield ? 'text-deck-body' : 'text-slate-700'}`}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={
                  isCopsefield
                    ? 'mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text focus:outline-none'
                    : 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none'
                }
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${isCopsefield ? 'text-deck-body' : 'text-slate-700'}`}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={
                  isCopsefield
                    ? 'mt-1 w-full rounded-md border border-deck-border bg-deck-surface px-3 py-2 text-sm text-deck-text focus:outline-none'
                    : 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none'
                }
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                isCopsefield ? 'bg-copsefield-accent' : 'bg-brand-primary'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

                   <p className="mt-3 text-center text-sm">
            <Link href="/forgot-password" className={`font-medium ${isCopsefield ? 'text-copsefield-accent' : 'text-brand-primary'}`}>
              Forgot password?
            </Link>
          </p>
          <p className={`mt-3 text-center text-sm ${isCopsefield ? 'text-deck-dim' : 'text-slate-500'}`}>
            No account?{' '}
            <Link href="/signup" className={`font-medium ${isCopsefield ? 'text-copsefield-accent' : 'text-brand-primary'}`}>
              Sign up
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
