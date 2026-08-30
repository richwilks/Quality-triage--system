// Signal-alert emails via Resend's HTTP API - needs RESEND_API_KEY (the
// user signs up at resend.com). Sends from Resend's shared sandbox address
// by default, which can deliver to any recipient with no domain
// verification, so RESEND_API_KEY is the only secret strictly required to
// get email alerts working.

import { strategyLabel } from './stockSignals'

const DEFAULT_FROM = 'Stock Signal Monitor <onboarding@resend.dev>'

export interface SignalEmailDetails {
  ticker: string
  action: 'BUY' | 'SELL'
  strategy: string
  price: number
  currency: string
  date: string
  detail: string
  strength: 'CONFIRMED' | 'WATCH'
  newsSnippet: string | null
}

const WATCH_LABEL: Record<'BUY' | 'SELL', string> = {
  BUY: 'approaching oversold/a golden cross',
  SELL: 'approaching overbought/a death cross',
}

export async function sendSignalEmail(to: string, details: SignalEmailDetails): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured - skipping email alert')
    return false
  }

  const { ticker, action, strategy, price, currency, date, detail, strength, newsSnippet } = details
  const label = strategyLabel(strategy)
  const subject =
    strength === 'WATCH'
      ? `Watch: ${ticker} ${action} - ${price.toFixed(2)} ${currency} (${label})`
      : `${ticker} ${action} - ${price.toFixed(2)} ${currency} (${label})`
  const headline =
    strength === 'WATCH'
      ? `${ticker} is in a watch zone (${WATCH_LABEL[action]}) as of ${date} - not a confirmed signal yet.`
      : `${action} signal detected for ${ticker} on ${date}.`
  const newsSection = newsSnippet ? `\n\nRecent headlines:\n${newsSnippet}` : ''
  const text = `${headline}\n\nStrategy: ${strategy}\nPrice: ${price.toFixed(2)} ${currency}\n\nWhy: ${detail}${newsSection}\n\nView the dashboard: https://inspectiq.co/dashboard/stock-monitor\n\nDecision-support only, based on lagging technical indicators - not financial advice.`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [to],
        subject,
        text,
      }),
    })
    if (!res.ok) {
      console.error('Resend email send failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('Resend email send failed:', err)
    return false
  }
}
