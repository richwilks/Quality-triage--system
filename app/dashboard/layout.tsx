import BottomNav from '@/components/BottomNav'
import Sidebar from '@/components/Sidebar'
import { BrandingProvider } from '@/components/BrandingContext'
import { ActiveInspectionProvider } from '@/components/ActiveInspectionContext'
import ActiveInspectionBanner from '@/components/ActiveInspectionBanner'
import { loadBranding } from '@/lib/branding'
import { syncCompanyAccess } from '@/lib/companySync'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Converts any pending project invites into project_members rows for the
  // signed-in user. This previously only ran on the explicit login/signup
  // form submit, so a user assigned to a project while they already had an
  // active session (the common case - most people stay logged in) never
  // picked it up until they happened to log out and back in. Running it here
  // means every dashboard page load stays in sync, not just a fresh login.
  const supabase = await createClient()
  await syncCompanyAccess(supabase)

  const { branding, accentColor } = await loadBranding('inspectiq')

  return (
    <div className="dashboard-shell pb-20 lg:pb-0 lg:pl-56 print:pb-0 print:pl-0">
      {accentColor && <style>{`:root { --deck-accent-color: ${accentColor}; }`}</style>}
      <BrandingProvider value={branding}>
        <ActiveInspectionProvider>
          <Sidebar />
          <ActiveInspectionBanner />
          {children}
          <BottomNav />
        </ActiveInspectionProvider>
      </BrandingProvider>
    </div>
  )
}
