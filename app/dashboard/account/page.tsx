'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

export default function AccountPage() {
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('full_name, company_name, role, email')
      .eq('id', user.id)
      .single()

    if (data) {
      setFullName(data.full_name || '')
      setCompanyName(data.company_name || '')
      setRole(data.role || '')
      setEmail(data.email || '')
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ full_name: fullName, company_name: companyName })
      .eq('id', user.id)

    setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">My Account</h1>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Account type
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {role === 'internal' ? 'Internal (SPHL)' : role === 'partner' ? 'Supply chain partner' : role}
          </p>

          <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
          <p className="mt-1 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">{email}</p>

          <label className="mt-4 block text-sm font-medium text-slate-700">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">Company</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Sweet Projects Holdings Limited"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {role === 'partner' && (
            <p className="mt-1 text-xs text-slate-400">
              This must match your company name exactly as it will be used to group your team's assigned defects.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <p className="mt-2 text-sm text-green-600">Saved.</p>}
        </div>
      </div>
    </div>
  )
}
