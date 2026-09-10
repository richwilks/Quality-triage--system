'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function HomeownerSignupPage() {
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'partner',
          account_type: 'homeowner',
        },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
            <h1 className="mt-3 text-2xl font-semibold text-brand-ink">Snag My Home</h1>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Account created</h2>
            <p className="mt-2 text-sm text-slate-500">
              You can now{' '}
              <Link href="/login?redirect=/snag" className="font-medium text-brand-primary">
                sign in
              </Link>{' '}
              and start logging snags.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">Snag My Home</h1>
          <p className="mt-1 text-center text-sm text-slate-500">
            List what's wrong with your new home, in your own words, and build a report to support your case.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Just your name, email, and a password - that's it.</p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Your name</label>
              <input
                spellCheck="true"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-primary px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login?redirect=/snag" className="font-medium text-brand-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
