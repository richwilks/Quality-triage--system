import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWatchlistAdminClient } from '@/lib/supabase/watchlistAdmin'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const watchlistDb = createWatchlistAdminClient()

  const [{ data: settings }, { data: subscriptions }] = await Promise.all([
    watchlistDb.from('notification_settings').select('email, email_enabled').eq('user_id', user.id).maybeSingle(),
    watchlistDb.from('push_subscriptions').select('id').eq('user_id', user.id),
  ])

  return NextResponse.json({
    email: settings?.email ?? user.email ?? '',
    emailEnabled: settings?.email_enabled ?? true,
    pushEnabled: (subscriptions || []).length > 0,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { email, emailEnabled } = await req.json()
  const trimmedEmail = String(email || '').trim()
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const { error } = await createWatchlistAdminClient()
    .from('notification_settings')
    .upsert(
      { user_id: user.id, email: trimmedEmail, email_enabled: !!emailEnabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Could not save notification settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
