'use client'

import { useMemo, useRef, useState } from 'react'

export type StockSignal = {
  strategy: 'SMA_CROSSOVER' | 'RSI'
  action: 'BUY' | 'SELL'
  date: string
  index: number
  detail: string
}

export type StockHistory = {
  ticker: string
  dates: string[]
  close: number[]
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  signals: StockSignal[]
}

// Categorical slots assigned in fixed order (blue/aqua/violet), validated
// against a white chart surface for CVD + contrast; status colors (green/red)
// are reserved for BUY/SELL and kept out of the line palette so a marker is
// never mistaken for a fourth series.
const COLOR = {
  close: '#2a78d6',
  sma50: '#1baf7a',
  sma200: '#4a3aa7',
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

export default function StockChart({ history }: { history: StockHistory }) {
  const { dates, close, sma50, sma200, rsi, signals } = history
  const n = dates.length
  const [hovered, setHovered] = useState<number | null>(null)
  const priceRef = useRef<SVGSVGElement>(null)
  const rsiRef = useRef<SVGSVGElement>(null)

  const plotRight = VIEW_W - MARGIN.right
  const xScale = (i: number) => (n <= 1 ? MARGIN.left : MARGIN.left + (i / (n - 1)) * (plotRight - MARGIN.left))

  const priceBottom = PRICE_H - PRICE_BOTTOM
  const { min: priceMin, max: priceMax } = useMemo(() => {
    const values = [...close, ...sma50, ...sma200].filter((v): v is number => v != null)
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.08 || 1
    return { min: lo - pad, max: hi + pad }
  }, [close, sma50, sma200])
  const priceYScale = (v: number) => priceBottom - ((v - priceMin) / (priceMax - priceMin)) * (priceBottom - MARGIN.top)

  const rsiBottom = RSI_H - RSI_BOTTOM
  const rsiYScale = (v: number) => rsiBottom - (v / 100) * (rsiBottom - MARGIN.top)

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

  const smaSignals = signals.filter((s) => s.strategy === 'SMA_CROSSOVER')
  const rsiSignals = signals.filter((s) => s.strategy === 'RSI')

  const hoveredSignals = hovered != null ? signals.filter((s) => s.index === hovered) : []
  const tooltipLeftPct = hovered != null ? (xScale(hovered) / VIEW_W) * 100 : null

  return (
    <div className="space-y-1">
      {/* Legend - identity channel for the 3 line series, plus the BUY/SELL status key */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-deck-body">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.close }} />
          Close
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.sma50 }} />
          50-day SMA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR.sma200 }} />
          200-day SMA
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points="5,0 10,9 0,9" fill={COLOR.buy} />
          </svg>
          BUY
        </span>
        <span className="flex items-center gap-1.5">
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
                {niceDate(dates[0])}
              </text>
              <text x={plotRight} y={PRICE_H - 8} textAnchor="end" fontSize={10} fill={COLOR.ink}>
                {niceDate(dates[n - 1])}
              </text>
            </>
          )}

          <path d={buildPath(sma200, xScale, priceYScale)} fill="none" stroke={COLOR.sma200} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={buildPath(sma50, xScale, priceYScale)} fill="none" stroke={COLOR.sma50} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path
            d={buildPath(close.map((v) => v), xScale, priceYScale)}
            fill="none"
            stroke={COLOR.close}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {smaSignals.map((s, idx) => {
            const x = xScale(s.index)
            const y = priceYScale(close[s.index])
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
            <p className="font-semibold text-deck-text">{niceDate(dates[hovered])}</p>
            <p className="mt-1 text-deck-body">
              Close <span className="font-semibold text-deck-text">{close[hovered].toFixed(2)}</span>
            </p>
            {sma50[hovered] != null && (
              <p className="text-deck-body">
                SMA 50 <span className="font-semibold text-deck-text">{sma50[hovered]!.toFixed(2)}</span>
              </p>
            )}
            {sma200[hovered] != null && (
              <p className="text-deck-body">
                SMA 200 <span className="font-semibold text-deck-text">{sma200[hovered]!.toFixed(2)}</span>
              </p>
            )}
            {rsi[hovered] != null && (
              <p className="text-deck-body">
                RSI <span className="font-semibold text-deck-text">{rsi[hovered]!.toFixed(1)}</span>
              </p>
            )}
            {hoveredSignals.map((s, idx) => (
              <p key={idx} className={`mt-1 font-semibold ${s.action === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                {s.action} - {s.strategy === 'SMA_CROSSOVER' ? 'SMA crossover' : 'RSI'}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* RSI panel - its own 0-100 scale, kept as a separate chart rather than
          a second y-axis on the price panel. */}
      <p className="pt-2 text-xs font-medium uppercase tracking-wide text-deck-dim">RSI (14-day)</p>
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

          <path d={buildPath(rsi, xScale, rsiYScale)} fill="none" stroke={COLOR.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {rsiSignals.map((s, idx) => {
            const x = xScale(s.index)
            const y = rsiYScale(rsi[s.index]!)
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
                {signals.map((s, idx) => (
                  <tr key={idx} className="border-t border-deck-border">
                    <td className="py-1 pr-3 text-deck-body">{niceDate(s.date)}</td>
                    <td className={`py-1 pr-3 font-semibold ${s.action === 'BUY' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {s.action}
                    </td>
                    <td className="py-1 pr-3 text-deck-body">{s.strategy === 'SMA_CROSSOVER' ? 'SMA crossover' : 'RSI'}</td>
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
