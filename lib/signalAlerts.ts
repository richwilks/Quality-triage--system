import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReconcileResult } from './paperTrading'
import type { StockSignal } from './stockSignals'
import { sendSignalEmail } from './email'
import { sendPushNotification } from './webPush'

// Push notification bodies get cut off by the OS well before this length;
// email has no such limit so gets the full detail string.
const MAX_PUSH_BODY_CHARS = 140
const truncateForPush = (text: string) => (text.length > MAX_PUSH_BODY_CHARS ? `${text.slice(0, MAX_PUSH_BODY_CHARS - 1)}…` : text)

interface AlertChannels {
  email: string | null
  emailEnabled: boolean
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[]
}

// Shared by notifyReconcileResult and notifyWatchSignals below - both fan
// out to the same per-user email/push destinations.
async function getUserAlertChannels(supabaseAdmin: SupabaseClient, userId: string): Promise<AlertChannels> {
  const [{ data: settings }, { data: subscriptions }] = await Promise.all([
    supabaseAdmin.from('notification_settings').select('email, email_enabled').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId),
  ])
  return {
    email: settings?.email ?? null,
    emailEnabled: settings?.email_enabled !== false,
    subscriptions: subscriptions || [],
  }
}

async function sendToChannels(
  supabaseAdmin: SupabaseClient,
  channels: AlertChannels,
  ticker: string,
  action: 'BUY' | 'SELL',
  strategy: string,
  price: number,
  currency: string,
  date: string,
  detail: string,
  strength: 'CONFIRMED' | 'WATCH',
  newsSnippet: string | null
): Promise<void> {
  if (channels.email && channels.emailEnabled) {
    await sendSignalEmail(channels.email, { ticker, currency, action, strategy, price, date, detail, strength, newsSnippet })
  }

  for (const sub of channels.subscriptions) {
    const outcome = await sendPushNotification(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      {
        title: strength === 'WATCH' ? `${ticker} watch: ${action}` : `${ticker} ${action} signal`,
        body: truncateForPush(detail),
        url: '/dashboard/stock-monitor',
      }
    )
    if (outcome === 'expired') {
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
}

// Best-effort record of a signal firing, for signal_strength/news_snippet
// to live in one place per the ask - never gates whether an alert sends,
// and failures here are swallowed (a logging write must never break the
// actual notification).
async function recordSignalLog(
  supabaseAdmin: SupabaseClient,
  ticker: string,
  date: string,
  strategy: string,
  action: 'BUY' | 'SELL',
  strength: 'confirmed' | 'watch',
  detail: string,
  newsSnippet: string | null
): Promise<void> {
  await supabaseAdmin
    .from('signal_log')
    .insert({ ticker, signal_date: date, strategy, action, signal_strength: strength, detail, news_snippet: newsSnippet })
}

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
  result: ReconcileResult,
  newsSnippet: string | null = null
): Promise<void> {
  if (result.toInsert.length === 0 && result.toClose.length === 0) return

  const channels = await getUserAlertChannels(supabaseAdmin, userId)

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

  for (const event of events) {
    await sendToChannels(
      supabaseAdmin,
      channels,
      ticker,
      event.action,
      event.strategy,
      event.price,
      currency,
      event.date,
      event.detail,
      'CONFIRMED',
      newsSnippet
    )
    await recordSignalLog(supabaseAdmin, ticker, event.date, event.strategy, event.action, 'confirmed', event.detail, newsSnippet)
  }
}

// Near-trigger heads-up (lib/stockSignals.ts's watchSignals) - unlike
// confirmed signals, there's no paper_trades row for a near-miss to
// dedupe against, so signal_log's unique constraint on (ticker, date,
// strategy, action, signal_strength) IS the dedupe here: a fresh insert
// means genuinely new, a unique-violation means this exact watch signal
// was already alerted on an earlier run.
export async function notifyWatchSignals(
  supabaseAdmin: SupabaseClient,
  ticker: string,
  currency: string,
  watchSignals: StockSignal[],
  close: number[],
  userIds: string[],
  newsSnippet: string | null = null
): Promise<void> {
  if (watchSignals.length === 0 || userIds.length === 0) return

  for (const signal of watchSignals) {
    const { error } = await supabaseAdmin.from('signal_log').insert({
      ticker,
      signal_date: signal.date,
      strategy: signal.strategy,
      action: signal.action,
      signal_strength: 'watch',
      detail: signal.detail,
      news_snippet: newsSnippet,
    })
    if (error) {
      if (error.code === '23505') continue // already alerted
      continue // some other write error - don't alert on an unrecorded signal
    }

    for (const userId of userIds) {
      const channels = await getUserAlertChannels(supabaseAdmin, userId)
      await sendToChannels(
        supabaseAdmin,
        channels,
        ticker,
        signal.action,
        signal.strategy,
        close[signal.index],
        currency,
        signal.date,
        signal.detail,
        'WATCH',
        newsSnippet
      )
    }
  }
}
