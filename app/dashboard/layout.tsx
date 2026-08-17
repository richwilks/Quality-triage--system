import BottomNav from '@/components/BottomNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-shell pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
