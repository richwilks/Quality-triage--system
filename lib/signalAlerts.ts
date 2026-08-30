import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReconcileResult } from './paperTrading'
import { sendSignalEmail } from './email'
import { sendPushNotification } from './webPush'

// Fires exactly when reconcileAndPersist (lib/paperTrading.ts) reports a
// genuinely new trade open/close for a user - so an alert can never drift
// out of sync with what the paper-trading ledger actually recorded. No
// separate dedupe here: reconcileAndPersist's own cutoffDate logic is what
// guarantees this is called at most once per real signal.
export async function notifyReconcileResult(
  supabaseAdmin: SupabaseClient,
  userId: string,
  ticker: string,
  currency: string,
  result: ReconcileResult
): Promise<void> {
  if (result.toInsert.length === 0 && result.toClose.length === 0) return

  const [{ data: settings }, { data: subscriptions }] = await Promise.all([
    supabaseAdmin
      .from('notification_settings')
      .select('email, email_enabled')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId),
  ])

  const events: { action: 'BUY' | 'SELL'; strategy: string; price: number; date: string; detail: string }[] = [
    ...result.toInsert.map((t) => ({
      action: 'BUY' as const,
      strategy: t.entry_strategy,
      price: t.entry_price,
      date: t.entry_date,
      detail: t.entry_detail,
    })),
    ...result.toClose.map((c) => ({
      action: 'SELL' as const,
      strategy: c.exit_strategy,
      price: c.exit_price,
      date: c.exit_date,
      detail: c.exit_detail,
    })),
  ]

  // Push notification bodies get cut off by the OS well before this length;
  // email has no such limit so gets the full detail string.
  const MAX_PUSH_BODY_CHARS = 140
  const truncateForPush = (text: string) => (text.length > MAX_PUSH_BODY_CHARS ? `${text.slice(0, MAX_PUSH_BODY_CHARS - 1)}…` : text)

  for (const event of events) {
    if (settings?.email && settings.email_enabled !== false) {
      await sendSignalEmail(settings.email, { ticker, currency, ...event })
    }

    for (const sub of subscriptions || []) {
      const outcome = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: `${ticker} ${event.action} signal`,
          body: truncateForPush(event.detail),
          url: '/dashboard/stock-monitor',
        }
      )
      if (outcome === 'expired') {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}
