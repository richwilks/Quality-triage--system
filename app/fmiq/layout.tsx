import FMIQBottomNav from '@/components/FMIQBottomNav'

export default function FMIQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-shell pb-20">
      {children}
      <FMIQBottomNav />
    </div>
  )
}
