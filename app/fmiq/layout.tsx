import FMIQBottomNav from '@/components/FMIQBottomNav'
import { BrandingProvider } from '@/components/BrandingContext'
import { loadBranding } from '@/lib/branding'

export default async function FMIQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { branding, accentColor } = await loadBranding()

  return (
    <div className="dashboard-shell pb-20">
      {accentColor && <style>{`:root { --fmiq-accent-color: ${accentColor}; }`}</style>}
      <BrandingProvider value={branding}>
        {children}
        <FMIQBottomNav />
      </BrandingProvider>
    </div>
  )
}
