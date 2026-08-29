// Signal-alert emails via Resend's HTTP API - needs RESEND_API_KEY (the
// user signs up at resend.com). Sends from Resend's shared sandbox address
// by default, which can deliver to any recipient with no domain
// verification, so RESEND_API_KEY is the only secret strictly required to
// get email alerts working.

const DEFAULT_FROM = 'Stock Signal Monitor <onboarding@resend.dev>'

export interface SignalEmailDetails {
  ticker: string
  action: 'BUY' | 'SELL'
  strategy: string
  price: number
  currency: string
  date: string
}

export async function sendSignalEmail(to: string, details: SignalEmailDetails): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured - skipping email alert')
    return false
  }

  const { ticker, action, strategy, price, currency, date } = details
  const subject = `${action} signal: ${ticker}`
  const text = `${action} signal detected for ${ticker} on ${date}.\n\nStrategy: ${strategy}\nPrice: ${price.toFixed(2)} ${currency}\n\nView the dashboard: https://inspectiq.co/dashboard/stock-monitor\n\nDecision-support only, based on lagging technical indicators - not financial advice.`

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
