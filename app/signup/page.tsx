'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { syncCompanyAccess } from '@/lib/companySync'

export default function SignupPage() {
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState<'internal' | 'partner'>('internal')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          company_name: companyName,
        },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data.session) {
      await syncCompanyAccess(supabase)
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
            <h1 className="mt-3 text-2xl font-semibold text-brand-ink">InspectIQ</h1>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Account created</h2>
            <p className="mt-2 text-sm text-slate-500">
              You can now{' '}
              <Link href="/login" className="font-medium text-brand-primary">
                sign in
              </Link>
              . If your employer already has projects set up, you'll be added to them automatically once you sign in.
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
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">InspectIQ</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Create account</h2>
          <p className="mt-1 text-sm text-slate-500">
            Register as a principal contractor or a sub contractor.
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Account type
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole('internal')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                    role === 'internal'
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-slate-300 text-slate-700'
                  }`}
                >
                  Principal contractor
                </button>
                <button
                  type="button"
                  onClick={() => setRole('partner')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                    role === 'partner'
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-slate-300 text-slate-700'
                  }`}
                >
                  Sub contractor
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Employer
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Construction Ltd"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">
                If this matches a company already using InspectIQ, you'll get access to their relevant projects automatically.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
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
            <Link href="/login" className="font-medium text-brand-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
