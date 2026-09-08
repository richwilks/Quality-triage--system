export type Point = { x: number; y: number }

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Perpendicular distance from p to the segment a-b (clamped to the segment,
// not the infinite line, so it stays meaningful near the segment's ends).
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  const proj = { x: a.x + t * dx, y: a.y + t * dy }
  return dist(p, proj)
}

// Ramer-Douglas-Peucker, but recording which raw points fall under each kept
// segment (rather than just returning the simplified points) - the cleanup
// step needs that to tell a straight run from a genuine curve.
function simplifyWithRanges(points: Point[], startIdx: number, endIdx: number, epsilon: number, ranges: [number, number][]) {
  let maxDist = 0
  let index = startIdx
  for (let i = startIdx + 1; i < endIdx; i++) {
    const d = perpendicularDistance(points[i], points[startIdx], points[endIdx])
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }
  if (maxDist > epsilon && index !== startIdx) {
    simplifyWithRanges(points, startIdx, index, epsilon, ranges)
    simplifyWithRanges(points, index, endIdx, epsilon, ranges)
  } else {
    ranges.push([startIdx, endIdx])
  }
}

// Light moving-average smoothing to settle hand tremor while keeping the
// curve's actual shape, then thins it to a manageable point count.
function smoothSubpath(points: Point[]): Point[] {
  if (points.length <= 3) return points
  const smoothed = points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    return { x: (prev.x + p.x + next.x) / 3, y: (prev.y + p.y + next.y) / 3 }
  })
  const targetCount = Math.min(smoothed.length, 10)
  if (targetCount <= 1) return smoothed
  const step = (smoothed.length - 1) / (targetCount - 1)
  const thinned: Point[] = []
  for (let i = 0; i < targetCount; i++) {
    thinned.push(smoothed[Math.round(i * step)])
  }
  return thinned
}

// Turns a raw, wobbly freehand stroke into a clean shape: a run that's
// basically straight (allowing for hand tremor) collapses to one straight
// segment; a run with genuine, consistent curvature is smoothed and kept as
// a curve instead of being forced flat. Coordinates are in the same 0-100
// percent space as everything else on a drawing, so the result drops
// straight into the existing boundary/point storage with no format change.
export function cleanFreehandStroke(rawPoints: Point[]): Point[] {
  if (rawPoints.length < 3) return rawPoints

  const xs = rawPoints.map((p) => p.x)
  const ys = rawPoints.map((p) => p.y)
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const epsilon = span * 0.02

  const ranges: [number, number][] = []
  simplifyWithRanges(rawPoints, 0, rawPoints.length - 1, epsilon, ranges)
  ranges.sort((a, b) => a[0] - b[0])

  const result: Point[] = [rawPoints[ranges[0][0]]]
  ranges.forEach(([startIdx, endIdx]) => {
    const a = rawPoints[startIdx]
    const b = rawPoints[endIdx]
    const chordLen = dist(a, b)
    if (chordLen < 0.001) return

    let maxDeviation = 0
    for (let i = startIdx + 1; i < endIdx; i++) {
      maxDeviation = Math.max(maxDeviation, perpendicularDistance(rawPoints[i], a, b))
    }
    const straightness = maxDeviation / chordLen

    if (straightness < 0.06 || endIdx - startIdx < 4) {
      result.push(b)
    } else {
      const curvePoints = smoothSubpath(rawPoints.slice(startIdx, endIdx + 1))
      result.push(...curvePoints.slice(1))
    }
  })

  return result
}
