// Rough, clearly-labelled estimate of what running the news-sentiment
// scoring (scoreNewsSentiments in lib/anthropic.ts, called from
// news-cron/route.ts) costs in Anthropic API spend - not real billing data
// (this app has no access to actual usage/invoices), just current published
// pricing applied to a simplified usage model. Kept as a pure function with
// every assumption as a named constant/parameter so it's auditable and
// adjustable rather than an opaque number.
//
// Pricing: Claude Sonnet 5 (the model scoreNewsSentiments actually calls),
// $2/1M input tokens, $10/1M output tokens - current published rates as of
// this writing.
export const PRICE_INPUT_PER_MILLION_USD = 2.0
export const PRICE_OUTPUT_PER_MILLION_USD = 10.0

// news-cron only pays for a scoring call when a ticker has at least one new
// (unscored) article that hour - see the dedup-by-url check in
// news-cron/route.ts. This model simplifies that to "one scoring call per
// ticker per day," which is a slight overestimate on quiet news days (a
// small fixed-overhead cost even if the real system would have made zero
// calls that day) - conservative in the "don't understate cost" direction.
export const FIXED_INPUT_OVERHEAD_TOKENS_PER_CALL = 250 // the scoring prompt's instructions
export const PER_ARTICLE_INPUT_TOKENS = 40 // one numbered headline + short summary line
export const FIXED_OUTPUT_OVERHEAD_TOKENS_PER_CALL = 10 // JSON array brackets/formatting
export const PER_ARTICLE_OUTPUT_TOKENS = 4 // one score number per article

export interface AiCostEstimateInput {
  months: number
  tickerCount: number
  avgArticlesPerTickerPerDay: number
}

export interface AiCostEstimate {
  days: number
  totalCalls: number
  totalArticles: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export function estimateNewsAiCost(input: AiCostEstimateInput): AiCostEstimate {
  const { months, tickerCount, avgArticlesPerTickerPerDay } = input
  const days = Math.max(0, months) * 30 // approximate, not calendar-exact
  const totalCalls = tickerCount * days
  const totalArticles = tickerCount * avgArticlesPerTickerPerDay * days

  const inputTokens = totalCalls * FIXED_INPUT_OVERHEAD_TOKENS_PER_CALL + totalArticles * PER_ARTICLE_INPUT_TOKENS
  const outputTokens = totalCalls * FIXED_OUTPUT_OVERHEAD_TOKENS_PER_CALL + totalArticles * PER_ARTICLE_OUTPUT_TOKENS

  const costUsd =
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_MILLION_USD + (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MILLION_USD

  return { days, totalCalls, totalArticles, inputTokens, outputTokens, costUsd }
}
