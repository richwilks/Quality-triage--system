import type { Metadata } from 'next'
import CopsefieldBottomNav from '@/components/CopsefieldBottomNav'
import CopsefieldSidebar from '@/components/CopsefieldSidebar'

export const metadata: Metadata = {
  title: 'Copsefield Group',
  icons: {
    icon: '/branding/copsefield/shield-icon.png',
    apple: '/branding/copsefield/shield-icon.png',
  },
}

export default function CopsefieldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-shell pb-20 lg:pb-0 lg:pl-56 print:pb-0 print:pl-0">
      <CopsefieldSidebar />
      {children}
      <CopsefieldBottomNav />
    </div>
  )
}
