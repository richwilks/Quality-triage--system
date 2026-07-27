'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })

    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <img src="/icon-192.png" alt="InspectIQ" className="h-14 w-14 rounded-2xl shadow-sm" />
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">InspectIQ</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {success ? (
            <p className="text-sm font-medium text-green-700">Password updated. Redirecting...</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-slate-900">Reset your password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter the email and code from the reset email, then choose a new password.
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

                <div>
                  <label className="block text-sm font-medium text-slate-700">Reset code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code from the email"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">New password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brand-primary px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
