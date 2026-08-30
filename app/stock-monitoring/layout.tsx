import type { Metadata } from 'next'

// Overrides the root layout's manifest link (app/layout.tsx points at
// /manifest.json, whose start_url is "/dashboard") just for this route
// subtree, so a home-screen icon added from /stock-monitoring reliably
// relaunches here instead of at /dashboard. See manifest-stock-monitoring.json.
export const metadata: Metadata = {
  title: 'Stock Monitor',
  manifest: '/manifest-stock-monitoring.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Stock Monitor',
  },
}

export default function StockMonitoringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
