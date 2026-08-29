import webpush from 'web-push'

// Signal-alert push notifications via the Web Push / VAPID protocol - no
// external notification service, no per-message cost. Needs
// NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT (a
// mailto: contact address required by the push spec) as env vars; see
// public/sw.js for the client-side service worker that receives these.

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID env vars are not configured')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushSubscriptionRecord {
  endpoint: string
  p256dh: string
  auth: string
}

export interface SignalPushPayload {
  title: string
  body: string
  url: string
}

// Returns 'sent', 'expired' (the subscription is dead and its row should
// be deleted - a 404/410 from the push service means the browser/OS has
// unsubscribed it), or 'failed' (a transient error, worth leaving in place
// to retry next time).
export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: SignalPushPayload
): Promise<'sent' | 'expired' | 'failed'> {
  try {
    ensureConfigured()
  } catch (err) {
    console.error('Web push not configured:', err)
    return 'failed'
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    return 'sent'
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      return 'expired'
    }
    console.error('Push send failed:', err)
    return 'failed'
  }
}
