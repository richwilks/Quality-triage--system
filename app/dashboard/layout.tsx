import BottomNav from '@/components/BottomNav'
import Sidebar from '@/components/Sidebar'
import { BrandingProvider } from '@/components/BrandingContext'
import { loadBranding } from '@/lib/branding'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { branding, accentColor } = await loadBranding('inspectiq')

  return (
    <div className="dashboard-shell pb-20 lg:pb-0 lg:pl-56 print:pb-0 print:pl-0">
      {accentColor && <style>{`:root { --deck-accent-color: ${accentColor}; }`}</style>}
      <BrandingProvider value={branding}>
        <Sidebar />
        {children}
        <BottomNav />
      </BrandingProvider>
    </div>
  )
}
