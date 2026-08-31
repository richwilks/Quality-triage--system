'use client'

import { useMemo, useRef, useState } from 'react'
import { strategyLabel } from '@/lib/stockSignals'

export type StockSignal = {
  strategy: 'SMA_CROSSOVER' | 'RSI' | 'MACD' | 'NEWS'
  action: 'BUY' | 'SELL'
  date: string
  index: number
  detail: string
}

export type MACDData = {
  macdLine: (number | null)[]
  signalLine: (number | null)[]
  histogram: (number | null)[]
}

export type StockHistory = {
  ticker: string
  dates: string[]
  close: number[]
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  macd: MACDData
  adx: (number | null)[]
  signals: StockSignal[]
  smaShortWindow: number
  smaLongWindow: number
}

// Categorical slots assigned in fixed order (blue/orange/aqua/violet),
// validated against a white chart surface for CVD + contrast; status colors
// (green/red) are reserved for BUY/SELL and kept out of the line palette so
// a marker is never mistaken for a series.
const COLOR = {
  close: '#2a78d6',
  sma50: '#1baf7a',
  sma200: '#4a3aa7',
  macdLine: '#eb6834',
  buy: '#0ca30c',
  sell: '#d03b3b',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  ink: '#767162',
  surface: '#FFFFFF',
}

const VIEW_W = 800
const MARGIN = { left: 44, right: 16, top: 12 }
const PRICE_H = 260
const PRICE_BOTTOM = 28
const RSI_H = 140
const RSI_BOTTOM = 28
const MACD_H = 140
const MACD_BOTTOM = 28

function buildPath(values: (number | null)[], xScale: (i: number) => number, yScale: (v: number) => number): string {
  let d = ''
  let drawing = false
  values.forEach((v, i) => {
    if (v == null) {
      drawing = false
      return
    }
    const x = xScale(i)
    const y = yScale(v)
    d += drawing ? ` L ${x} ${y}` : `M ${x} ${y}`
    drawing = true
  })
  return d
}

function niceDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Trailing trading-day windows for the range picker; 'All' shows everything
// the API returned (nominally a year of daily closes).
const RANGE_PRESETS: { label: string; days: number | null }[] = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: 'All', days: null },
]

export default function StockChart({ history }: { history: StockHistory }) {
  const { dates, close, sma50, sma200, rsi, macd, signals, smaShortWindow, smaLongWindow } = history
  const fullN = dates.length
  const [hovered, setHovered] = useState<number | null>(null)
  const [rangeDays, setRangeDays] = useState<number | null>(63)
  const [showSma50, setShowSma50] = useState(true)
  const [showSma200, setShowSma200] = useState(true)
  const [showRsiPanel, setShowRsiPanel] = useState(true)
  const [showMacdPanel, setShowMacdPanel] = useState(true)
  const priceRef = useRef<SVGSVGElement>(null)
  const rsiRef = useRef<SVGSVGElement>(null)
  const macdRef = useRef<SVGSVGElement>(null)

  // Client-side zoom: the API already returns the full fetched history, so a
  // range preset just slices it and re-scales the y-axes to what's visible,
  // rather than re-fetching.
  const sliceStart = rangeDays == null ? 0 : Math.max(0, fullN - rangeDays)
  const vDates = dates.slice(sliceStart)
  const vClose = close.slice(sliceStart)
  const vSma50 = sma50.slice(sliceStart)
  const vSma200 = sma200.slice(sliceStart)
  const vRsi = rsi.slice(sliceStart)
  const vMacd: MACDData = {
    macdLine: macd.macdLine.slice(sliceStart),
    signalLine: macd.signalLine.slice(sliceStart),
    histogram: macd.histogram.slice(sliceStart),
  }
  const vSignals = useMemo(
    () => signals.filter((s) => s.index >= sliceStart).map((s) => ({ ...s, index: s.index - sliceStart })),
    [signals, sliceStart]
  )
  const n = vDates.length

  const plotRight = VIEW_W - MARGIN.right
  const xScale = (i: number) => (n <= 1 ? MARGIN.left : MARGIN.left + (i / (n - 1)) * (plotRight - MARGIN.left))

  const priceBottom = PRICE_H - PRICE_BOTTOM
  const { min: priceMin, max: priceMax } = useMemo(() => {
    const values = [...vClose, ...(showSma50 ? vSma50 : []), ...(showSma200 ? vSma200 : [])].filter(
      (v): v is number => v != null
    )
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.08 || 1
    return { min: lo - pad, max: hi + pad }
  }, [vClose, vSma50, vSma200, showSma50, showSma200])
  const priceYScale = (v: number) => priceBottom - ((v - priceMin) / (priceMax - priceMin)) * (priceBottom - MARGIN.top)

  const rsiBottom = RSI_H - RSI_BOTTOM
  const rsiYScale = (v: number) => rsiBottom - (v / 100) * (rsiBottom - MARGIN.top)

  const macdBottom = MACD_H - MACD_BOTTOM
  const { min: macdMin, max: macdMax } = useMemo(() => {
    const values = [...vMacd.macdLine, ...vMacd.signalLine].filter((v): v is number => v != null)
    if (values.length === 0) return { min: -1, max: 1 }
    const lo = Math.min(...values, 0)
    const hi = Math.max(...values, 0)
    const pad = (hi - lo) * 0.1 || 1
    return { min: lo - pad, max: hi + pad }
  }, [vMacd])
  const macdYScale = (v: number) => macdBottom - ((v - macdMin) / (macdMax - macdMin)) * (macdBottom - MARGIN.top)

  function indexFromClientX(svg: SVGSVGElement | null, clientX: number): number {
    if (!svg || n === 0) return 0
    const rect = svg.getBoundingClientRect()
    const frac = (clientX - rect.left) / rect.width
    const viewX = frac * VIEW_W
    const t = (viewX - MARGIN.left) / (plotRight - MARGIN.left)
    return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
  }

  const priceGridLines = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, s) => {
      const v = priceMin + (s / steps) * (priceMax - priceMin)
      return { y: priceYScale(v), label: v.toFixed(v < 10 ? 2 : 0) }
    })
  }, [priceMin, priceMax])

  const smaSignals = vSignals.filter((s) => s.strategy === 'SMA_CROSSOVER')
  const rsiSignals = vSignals.filter((s) => s.strategy === 'RSI')
  const macdSignals = vSignals.filter((s) => s.strategy === 'MACD')

  const hoveredSignals = hovered != null ? vSignals.filter((s) => s.index === hovered) : []
  const tooltipLeftPct = hovered != null ? (xScale(hovered) / VIEW_W) * 100 : null

  return (
    <div className="space-y-2">
      {/* Range picker - zooms the whole chart (all panels + y-axes rescale)
          without a re-fetch, since the API already returns the full window. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setRangeDays(p.days)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              rangeDays === p.days
                ? 'bg-deck-accent text-white'
                : 'border border-deck-border text-deck-body hover:bg-deck-raised'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Legend - identity channel for the line series, plus the BUY/SELL status key.
          Close always shows; the SMA chips double as show/hide toggles so a busy
          chart can be decluttered without losing the crosshair/tooltip. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-deck-body">
        <span className="flex items-center gap-1.5 rounded-full px-2 py-1">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.close }} />
          Close
        </span>
        <button
          type="button"
          aria-pressed={showSma50}
          onClick={() => setShowSma50((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors ${
            showSma50 ? 'border-transparent' : 'border-deck-border text-deck-dim opacity-50'
          }`}
        >
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.sma50 }} />
          {smaShortWindow}-day SMA
        </button>
        <button
          type="button"
          aria-pressed={showSma200}
          onClick={() => setShowSma200((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors ${
            showSma200 ? 'border-transparent' : 'border-deck-border text-deck-dim opacity-50'
          }`}
        >
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.sma200 }} />
          {smaLongWindow}-day SMA
        </button>
        <span className="flex items-center gap-1.5 px-2 py-1">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points="5,0 10,9 0,9" fill={COLOR.buy} />
          </svg>
          BUY
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points="0,0 10,0 5,9" fill={COLOR.sell} />
          </svg>
          SELL
        </span>
      </div>

      {/* Price panel */}
      <div className="relative">
        <svg
          ref={priceRef}
          viewBox={`0 0 ${VIEW_W} ${PRICE_H}`}
          className="w-full touch-none"
          onPointerMove={(e) => setHovered(indexFromClientX(priceRef.current, e.clientX))}
          onPointerLeave={() => setHovered(null)}
        >
          {priceGridLines.map((g, idx) => (
            <g key={idx}>
              <line x1={MARGIN.left} x2={plotRight} y1={g.y} y2={g.y} stroke={COLOR.grid} strokeWidth={1} />
              <text x={MARGIN.left - 6} y={g.y + 3} textAnchor="end" fontSize={10} fill={COLOR.ink}>
                {g.label}
              </text>
            </g>
          ))}

          {n > 0 && (
            <>
              <text x={MARGIN.left} y={PRICE_H - 8} fontSize={10} fill={COLOR.ink}>
                {niceDate(vDates[0])}
              </text>
              <text x={plotRight} y={PRICE_H - 8} textAnchor="end" fontSize={10} fill={COLOR.ink}>
                {niceDate(vDates[n - 1])}
              </text>
            </>
          )}

          {showSma200 && (
            <path d={buildPath(vSma200, xScale, priceYScale)} fill="none" stroke={COLOR.sma200} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {showSma50 && (
            <path d={buildPath(vSma50, xScale, priceYScale)} fill="none" stroke={COLOR.sma50} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          <path
            d={buildPath(vClose, xScale, priceYScale)}
            fill="none"
            stroke={COLOR.close}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {smaSignals.map((s, idx) => {
            const x = xScale(s.index)
            const y = priceYScale(vClose[s.index])
            const isBuy = s.action === 'BUY'
            const yOffset = isBuy ? y + 14 : y - 14
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r={3} fill={COLOR.surface} stroke={isBuy ? COLOR.buy : COLOR.sell} strokeWidth={2} />
                {isBuy ? (
                  <polygon
                    points={`${x - 5},${yOffset + 5} ${x + 5},${yOffset + 5} ${x},${yOffset - 5}`}
                    fill={COLOR.buy}
                    stroke={COLOR.surface}
                    strokeWidth={2}
                  />
                ) : (
                  <polygon
                    points={`${x - 5},${yOffset - 5} ${x + 5},${yOffset - 5} ${x},${yOffset + 5}`}
                    fill={COLOR.sell}
                    stroke={COLOR.surface}
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}

          {hovered != null && (
            <line x1={xScale(hovered)} x2={xScale(hovered)} y1={MARGIN.top} y2={priceBottom} stroke={COLOR.axis} strokeWidth={1} />
          )}
        </svg>

        {hovered != null && tooltipLeftPct != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 -translate-x-1/2 rounded-md border border-deck-border bg-deck-surface p-2 text-xs shadow-md"
            style={{ left: `${Math.min(Math.max(tooltipLeftPct, 12), 88)}%` }}
          >
            <p className="font-semibold text-deck-text">{niceDate(vDates[hovered])}</p>
            <p className="mt-1 text-deck-body">
              Close <span className="font-semibold text-deck-text">{vClose[hovered].toFixed(2)}</span>
            </p>
            {showSma50 && vSma50[hovered] != null && (
              <p className="text-deck-body">
                {smaShortWindow}-day SMA <span className="font-semibold text-deck-text">{vSma50[hovered]!.toFixed(2)}</span>
              </p>
            )}
            {showSma200 && vSma200[hovered] != null && (
              <p className="text-deck-body">
                {smaLongWindow}-day SMA <span className="font-semibold text-deck-text">{vSma200[hovered]!.toFixed(2)}</span>
              </p>
            )}
            {showRsiPanel && vRsi[hovered] != null && (
              <p className="text-deck-body">
                RSI <span className="font-semibold text-deck-text">{vRsi[hovered]!.toFixed(1)}</span>
              </p>
            )}
            {hoveredSignals.map((s, idx) => (
              <p key={idx} className={`mt-1 font-semibold ${s.action === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                {s.action} - {strategyLabel(s.strategy)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* RSI panel - its own 0-100 scale, kept as a separate chart rather than
          a second y-axis on the price panel. Collapsible so it can be tucked
          away when only the price trend matters. */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">RSI (14-day)</p>
        <button
          type="button"
          onClick={() => setShowRsiPanel((v) => !v)}
          className="text-xs font-medium text-deck-accent"
        >
          {showRsiPanel ? 'Hide' : 'Show'}
        </button>
      </div>
      {showRsiPanel && (
        <div className="relative">
          <svg
            ref={rsiRef}
            viewBox={`0 0 ${VIEW_W} ${RSI_H}`}
            className="w-full touch-none"
            onPointerMove={(e) => setHovered(indexFromClientX(rsiRef.current, e.clientX))}
            onPointerLeave={() => setHovered(null)}
          >
            <line x1={MARGIN.left} x2={plotRight} y1={rsiYScale(70)} y2={rsiYScale(70)} stroke={COLOR.grid} strokeWidth={1} />
            <text x={plotRight + 2} y={rsiYScale(70) + 3} fontSize={9} fill={COLOR.ink}>
              70 overbought
            </text>
            <line x1={MARGIN.left} x2={plotRight} y1={rsiYScale(30)} y2={rsiYScale(30)} stroke={COLOR.grid} strokeWidth={1} />
            <text x={plotRight + 2} y={rsiYScale(30) + 3} fontSize={9} fill={COLOR.ink}>
              30 oversold
            </text>

            <path d={buildPath(vRsi, xScale, rsiYScale)} fill="none" stroke={COLOR.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {rsiSignals.map((s, idx) => {
              const x = xScale(s.index)
              const y = rsiYScale(vRsi[s.index]!)
              const isBuy = s.action === 'BUY'
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={isBuy ? COLOR.buy : COLOR.sell}
                  stroke={COLOR.surface}
                  strokeWidth={2}
                />
              )
            })}

            {hovered != null && (
              <line x1={xScale(hovered)} x2={xScale(hovered)} y1={MARGIN.top} y2={rsiBottom} stroke={COLOR.axis} strokeWidth={1} />
            )}
          </svg>
        </div>
      )}

      {/* MACD panel - line + signal line, own scale (can go negative, unlike
          price/RSI), so it's a separate chart rather than sharing an axis.
          Collapsible for the same reason as RSI above. */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">MACD (12, 26, 9)</p>
        <button
          type="button"
          onClick={() => setShowMacdPanel((v) => !v)}
          className="text-xs font-medium text-deck-accent"
        >
          {showMacdPanel ? 'Hide' : 'Show'}
        </button>
      </div>
      {showMacdPanel && (
      <div className="flex items-center gap-4 text-xs text-deck-body">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.macdLine }} />
          MACD
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.ink }} />
          Signal
        </span>
      </div>
      )}
      {showMacdPanel && (
      <div className="relative">
        <svg
          ref={macdRef}
          viewBox={`0 0 ${VIEW_W} ${MACD_H}`}
          className="w-full touch-none"
          onPointerMove={(e) => setHovered(indexFromClientX(macdRef.current, e.clientX))}
          onPointerLeave={() => setHovered(null)}
        >
          <line x1={MARGIN.left} x2={plotRight} y1={macdYScale(0)} y2={macdYScale(0)} stroke={COLOR.grid} strokeWidth={1} />

          {vMacd.histogram.map((h, i) => {
            if (h == null) return null
            const x = xScale(i)
            const zeroY = macdYScale(0)
            const y = macdYScale(h)
            return (
              <rect
                key={i}
                x={x - 1}
                y={Math.min(y, zeroY)}
                width={2}
                height={Math.max(Math.abs(y - zeroY), 0.5)}
                fill={h >= 0 ? COLOR.buy : COLOR.sell}
                opacity={0.25}
              />
            )
          })}

          <path d={buildPath(vMacd.signalLine, xScale, macdYScale)} fill="none" stroke={COLOR.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={buildPath(vMacd.macdLine, xScale, macdYScale)} fill="none" stroke={COLOR.macdLine} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {macdSignals.map((s, idx) => {
            const x = xScale(s.index)
            const y = macdYScale(vMacd.macdLine[s.index]!)
            const isBuy = s.action === 'BUY'
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={4}
                fill={isBuy ? COLOR.buy : COLOR.sell}
                stroke={COLOR.surface}
                strokeWidth={2}
              />
            )
          })}

          {hovered != null && (
            <line x1={xScale(hovered)} x2={xScale(hovered)} y1={MARGIN.top} y2={macdBottom} stroke={COLOR.axis} strokeWidth={1} />
          )}
        </svg>
      </div>
      )}

      {signals.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-xs font-medium text-deck-accent">
            View signal history ({signals.length})
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-deck-dim">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 font-medium">Action</th>
                  <th className="py-1 pr-3 font-medium">Strategy</th>
                  <th className="py-1 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {[...signals].reverse().map((s, idx) => (
                  <tr key={idx} className="border-t border-deck-border">
                    <td className="py-1 pr-3 text-deck-body">{niceDate(s.date)}</td>
                    <td className={`py-1 pr-3 font-semibold ${s.action === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {s.action}
                    </td>
                    <td className="py-1 pr-3 text-deck-body">{strategyLabel(s.strategy)}</td>
                    <td className="py-1 text-deck-body">{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
