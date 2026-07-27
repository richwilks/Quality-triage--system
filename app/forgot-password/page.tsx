'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://inspectiq.co/reset-password',
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">InspectIQ</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {sent ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Check your email</h2>
              <p className="mt-2 text-sm text-slate-500">
                If an account exists for {email}, a reset link has been sent.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-slate-900">Reset password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brand-primary px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-5 text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-primary">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
