import BottomNav from '@/components/BottomNav'
import { BrandingProvider } from '@/components/BrandingContext'
import { loadBranding } from '@/lib/branding'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { branding, accentColor } = await loadBranding()

  return (
    <div className="dashboard-shell pb-20">
      {accentColor && <style>{`:root { --deck-accent-color: ${accentColor}; }`}</style>}
      <BrandingProvider value={branding}>
        {children}
        <BottomNav />
      </BrandingProvider>
    </div>
  )
}
