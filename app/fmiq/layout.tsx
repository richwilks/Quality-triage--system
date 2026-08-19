import FMIQBottomNav from '@/components/FMIQBottomNav'
import FMIQSidebar from '@/components/FMIQSidebar'
import { BrandingProvider } from '@/components/BrandingContext'
import { loadBranding } from '@/lib/branding'

export default async function FMIQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { branding, accentColor } = await loadBranding('fmiq')

  return (
    <div className="dashboard-shell pb-20 lg:pb-0 lg:pl-56 print:pb-0 print:pl-0">
      {accentColor && <style>{`:root { --fmiq-accent-color: ${accentColor}; }`}</style>}
      <BrandingProvider value={branding}>
        <FMIQSidebar />
        {children}
        <FMIQBottomNav />
      </BrandingProvider>
    </div>
  )
}
